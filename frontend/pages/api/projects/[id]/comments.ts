import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

interface Comment {
  id: number;
  author: string;
  authorPHID: string;
  content: string;
  timestamp: string;
  dateCreated: number;
}

async function tryQueryFeed(
  client: ConduitClient,
  params: any,
  onError?: (err: unknown, context: { params: any }) => void
): Promise<any[]> {
  try {
    const r = await client.call<any>('feed.query', params);
    if (Array.isArray(r)) return r;
    if (Array.isArray(r?.data)) return r.data;
    if (r?.data && typeof r.data === 'object') return Object.values(r.data);
    if (Array.isArray(r?.stories)) return r.stories;
    if (r?.stories && typeof r.stories === 'object') return Object.values(r.stories);
    if (Array.isArray(r?.result)) return r.result;
    if (r?.result && typeof r.result === 'object') return Object.values(r.result);
    // In some deployments, feed.query returns a plain dict keyed by story PHID.
    // Example: { "PHID-STRY-...": {epoch, text, objectPHID, ...}, ... }
    if (r && typeof r === 'object') {
      const values = Object.values(r);
      if (
        values.length > 0 &&
        values.some((v: any) => v && typeof v === 'object' && (typeof v.epoch === 'number' || typeof v.text === 'string'))
      ) {
        return values;
      }
    }
    return [];
  } catch (err) {
    onError?.(err, { params });
    return [];
  }
}

function extractFeedStoryText(story: any): string {
  const candidates = [
    story?.storyText,
    story?.text,
    story?.title,
    story?.data?.text,
    story?.data?.storyText,
    story?.data?.title,
    story?.data?.content,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
  }
  return '';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Comment[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    res.removeHeader('ETag');
  } catch {
    // ignore
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid project ID' });
    }

    const client = new ConduitClient(host, token);

    // Get project info first to get the PHID
    const projectInfo = await client.call<any>('project.search', {
      constraints: {
        ids: [parseInt(id)],
      },
    });

    if (!projectInfo.data || projectInfo.data.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectInfo.data[0];
    const projectPHID = project.phid;
    const projectName = project.fields?.name || '';

    // Search for tasks with this project tag to get progress report comments
    const tasksResult = await client.call<any>('maniphest.search', {
      constraints: {
        projects: [projectPHID],
      },
      attachments: {
        subscribers: true,
      },
      limit: 100,
    });

    const tasks = tasksResult.data || [];
    const taskPHIDs = tasks.map((t: any) => t.phid);

    const comments: Comment[] = [];
    const userPHIDs = new Set<string>();

    // 目标：获取“进度汇报/待办事项/延期原因/讨论”等相关评论。
    // 实现：对项目下任务逐个调用 transaction.search，从 transaction.comments[0].content.raw 提取评论。
    // 说明：不要依赖 transaction.type 或 constraints.transactionTypes（不同版本可能不一致）。
    const keywordRegex = /(进度汇报|进度\s*汇报|进度|进展|待办事项|待办|延期原因|延期|讨论|周报|日报|更新|汇报)/i;

    let source: 'schedule' | 'task' | 'feed' = 'task';
    let scheduleCommentsFound = 0;
    let feedCommentsFound = 0;
    let feedProgressFound = 0;
    let feedStoriesTotal = 0;
    let feedQueryMode: 'filtered' | 'global' | 'none' = 'none';
    let scheduleSnapshot: Comment | null = null;
    let scheduleMonogram = '';
    let scheduleUriPath = '';
    let schedulePHID = '';
    const feedErrors: string[] = [];

    // 优先：从 schedule 系统的“进度项目”对象上取评论（进度汇报 type=report 通常写在这里）
    try {
      const scheduleResult = await client.call<any>('schedule.export.all', {
        objectType: 'project',
        formatKey: 'json',
      });

      let scheduleData: any[] = [];
      if (scheduleResult && scheduleResult['download URI']) {
        const downloadUrl = scheduleResult['download URI'];
        const resp = await fetch(downloadUrl);
        if (resp.ok) {
          const jsonData = await resp.json();
          if (Array.isArray(jsonData)) {
            scheduleData = jsonData;
          } else if (jsonData && Array.isArray(jsonData.data)) {
            scheduleData = jsonData.data;
          }
        }
      }

      const matchScheduleRecord = (item: any): boolean => {
        if (!item) return false;
        const itemPHID = item.projectPHID || item.phid || item.projectPhid || item.project?.phid || item.project?.projectPHID;
        if (itemPHID && String(itemPHID) === String(projectPHID)) return true;

        const itemName = item.projectName || item.project_name || item.name || item.project;
        if (itemName && projectName && String(itemName).trim() === String(projectName).trim()) return true;
        if (itemName && projectName && String(itemName).toLowerCase().includes(String(projectName).toLowerCase())) return true;

        const uri = item.uri || item.projectUrl || item.url;
        if (typeof uri === 'string' && uri.includes(`/project/schedule/${id}/`)) return true;

        return false;
      };

      const record = scheduleData.find(matchScheduleRecord);
      const scheduleCandidates: string[] = [];

      const tryExtractFromString = (s: string) => {
        const matches: string[] = [];
        const m1 = s.match(/schedule\/project\/(?:view|edit)\/(\d+)/);
        if (m1?.[1]) matches.push(m1[1]);
        const m2 = s.match(/schedule\/project\/(\d+)/);
        if (m2?.[1]) matches.push(m2[1]);
        const m3 = s.match(/\/schedule\/project\/edit\/(\d+)/);
        if (m3?.[1]) matches.push(m3[1]);
        const m4 = s.match(/[?&]id=(\d+)/);
        if (m4?.[1]) matches.push(m4[1]);
        const m5 = s.match(/[?&]projectID=(\d+)/i);
        if (m5?.[1]) matches.push(m5[1]);
        return matches;
      };

      if (record) {
        const recordUri: string | undefined = record.uri || record.projectUrl || record.url;
        const relatedUri: string | undefined = record.relatedUri;

        if (typeof record.monogram === 'string' && record.monogram.trim()) {
          scheduleMonogram = record.monogram.trim();
        }
        if (typeof recordUri === 'string' && recordUri.includes('/project/schedule/')) {
          try {
            scheduleUriPath = new URL(recordUri).pathname;
          } catch {
            // ignore
          }
        }
        if (!scheduleUriPath) {
          scheduleUriPath = `/project/schedule/${id}/`;
        }

        // 关键：用 schedule.edit 通过 Schedule 项目 ID 获取 Schedule PHID
        // 
        // 重要发现：schedule.edit 的 objectIdentifier 参数接受的是纯数字 ID，而不是 monogram
        // 例如：
        //   - ✅ 正确：objectIdentifier: "8054" (从 SC8054 提取的数字部分)
        //   - ❌ 错误：objectIdentifier: "SC8054" (monogram 格式会报错)
        //   - ❌ 错误：objectIdentifier: "19701" (这是 Phabricator 项目 ID，不是 Schedule 项目 ID)
        // 
        // 从 monogram 中提取数字 ID (SC8054 -> 8054)
        let scheduleProjectId = '';
        if (scheduleMonogram) {
          const monogramMatch = scheduleMonogram.match(/^SC(\d+)$/i);
          if (monogramMatch?.[1]) {
            scheduleProjectId = monogramMatch[1];
          }
        }
        
        
        // 尝试多种 objectIdentifier 格式（按优先级排序）
        const identifiersToTry = [
          scheduleProjectId,                    // "8054" - 最可能成功的格式
          scheduleMonogram,                     // "SC8054" - 备用尝试
          `SCHE${scheduleProjectId}`,           // "SCHE8054" - 备用尝试
          `schedule/${scheduleProjectId}`,      // "schedule/8054" - 备用尝试
        ].filter(Boolean);
        
        for (const identifier of identifiersToTry) {
          if (schedulePHID) break; // 已找到，跳出
          try {
            const editResult = await client.call<any>('schedule.edit', {
              objectIdentifier: identifier,
              transactions: [],
            });
            if (editResult?.object?.phid) {
              schedulePHID = editResult.object.phid;
              break;
            }
          } catch (e: any) {
          }
        }
        
        if (!schedulePHID) {
        }

        // 兜底方案：schedule.export.all(project) 自身就包含“最新进度描述”等字段。
        // 这不是历史评论列表，但可以作为“项目动态/进度汇报”的最新快照。
        // 优先使用 stageDesc（常见格式：日期--内容），并拼接 todo/delay 信息。
        const stageDesc = typeof record.stageDesc === 'string' ? record.stageDesc.trim() : '';
        const todoText = typeof record.todo === 'string' ? record.todo.trim() : '';
        const delayName = typeof record.delayName === 'string' ? record.delayName.trim() : '';
        const delayDesc = typeof record.delayDesc === 'string' ? record.delayDesc.trim() : '';
        const delayGroup = typeof record.delayGroup === 'string' ? record.delayGroup.trim() : '';
        const delayType = typeof record.delayType === 'string' ? record.delayType.trim() : '';
        const delayResp = typeof record.delayResp === 'string' ? record.delayResp.trim() : '';

        const snapshotParts: string[] = [];
        if (stageDesc) snapshotParts.push(stageDesc);
        if (todoText && todoText !== '暂无待办事项') snapshotParts.push(`待办事项：${todoText}`);

        const delayParts = [delayName && `原因：${delayName}`, delayType && `类型：${delayType}`, delayGroup && `责任组：${delayGroup}`, delayResp && `责任方：${delayResp}`, delayDesc && `描述：${delayDesc}`]
          .filter(Boolean)
          .join('，');
        if (delayParts) snapshotParts.push(`延期信息：${delayParts}`);

        const snapshotContent = snapshotParts.join('\n\n').trim();
        const scheduleDateModified = typeof record.dateModified === 'number' ? record.dateModified : 0;
        const scheduleDateCreated = typeof record.dateCreated === 'number' ? record.dateCreated : 0;
        const scheduleEpoch = scheduleDateModified || scheduleDateCreated || 0;

        if (snapshotContent) {
          const pmName = typeof record.projectManager === 'string' ? record.projectManager.trim() : '';
          scheduleSnapshot = {
            id: scheduleEpoch || Math.random(),
            author: pmName || 'Schedule',
            authorPHID: '',
            content: snapshotContent,
            timestamp: new Date(scheduleEpoch * 1000).toLocaleString('zh-CN'),
            dateCreated: scheduleEpoch,
          };
        }

        // schedule 系统里常见 monogram 形如 "SC9295"，其中 9295 往往就是 schedule project 的数字ID
        const monogramRaw = record.monogram;
        if (typeof monogramRaw === 'string' && monogramRaw.trim()) {
          scheduleCandidates.push(monogramRaw.trim());
          const monogramIdMatch = monogramRaw.trim().match(/^SC(\d+)$/i);
          if (monogramIdMatch?.[1]) {
            scheduleCandidates.push(monogramIdMatch[1]);
          }
        }

        // 尝试通过 Conduit 的 phid.lookup，把 SC9295 / 项目编号 / 项目名 映射成可用的 PHID
        try {
          const lookupNames = [
            typeof monogramRaw === 'string' ? monogramRaw.trim() : '',
            typeof record.projectNumber === 'string' ? record.projectNumber.trim() : '',
            projectName,
          ].filter((x) => typeof x === 'string' && x.trim());

          if (lookupNames.length > 0) {
            const lookupResult = await client.call<any>('phid.lookup', {
              names: lookupNames,
            });

            if (lookupResult && typeof lookupResult === 'object') {
              Object.values(lookupResult).forEach((phid) => {
                if (typeof phid === 'string' && phid.startsWith('PHID-')) {
                  scheduleCandidates.push(phid);
                }
              });
            }
          }
        } catch (lookupError: any) {
          // phid.lookup failed, continue with other methods
        }

        // 先尝试常见字段
        const recordPHID = record.phid || record.schedulePHID || record.schedulePhid || record.projectPHID || record.projectPhid;
        if (recordPHID && typeof recordPHID === 'string' && recordPHID.startsWith('PHID-')) {
          scheduleCandidates.push(recordPHID);
        }

        if (typeof recordUri === 'string') {
          scheduleCandidates.push(...tryExtractFromString(recordUri));
        }

        if (typeof relatedUri === 'string') {
          scheduleCandidates.push(...tryExtractFromString(relatedUri));
        }

        const recordId = record.projectId ?? record.projectID ?? record.id ?? record.scheduleId ?? record.scheduleID;
        if (typeof recordId === 'number' || (typeof recordId === 'string' && /^\d+$/.test(recordId))) {
          scheduleCandidates.push(String(recordId));
        }

        // 再做一次全字段扫描：尽可能从 record 中挖到 objectIdentifier
        for (const [k, v] of Object.entries(record)) {
          const key = String(k).toLowerCase();
          if (typeof v === 'string') {
            if ((key.includes('phid') || key.endsWith('phid')) && v.startsWith('PHID-')) {
              scheduleCandidates.push(v);
            }
            if (key.includes('uri') || key.includes('url') || v.includes('/schedule/')) {
              scheduleCandidates.push(...tryExtractFromString(v));
            }
            if ((key === 'id' || key.endsWith('id') || key.includes('id')) && /^\d+$/.test(v)) {
              scheduleCandidates.push(v);
            }
          } else if (typeof v === 'number') {
            if (key === 'id' || key.endsWith('id') || key.includes('id')) {
              scheduleCandidates.push(String(v));
            }
          }
        }
      }

      let uniqueScheduleCandidates = Array.from(new Set(scheduleCandidates)).filter(Boolean);

      // 如果还是没有候选，最后尝试用项目 PHID 本身查 transaction（有些系统会把评论挂在项目上）
      if (uniqueScheduleCandidates.length === 0) {
        uniqueScheduleCandidates = [String(projectPHID)];
      }

      // 如果有 Schedule PHID，直接用它获取所有评论
      if (schedulePHID) {
        try {
          const transactionsResult = await client.call<any>('transaction.search', {
            objectIdentifier: schedulePHID,
            limit: 1000, // 获取所有评论，不限制数量
          });

          const transactions = transactionsResult?.data || [];
          
          if (Array.isArray(transactions)) {
            // 第一遍：收集所有评论、编辑标记和删除标记
            const deletedTransactionIds = new Set<string>();
            const hiddenTransactionIds = new Set<string>();
            const editedContent = new Map<string, string>();
            
            for (const transaction of transactions) {
              const commentText = transaction?.comments?.[0]?.content?.raw || '';
              if (!commentText.trim()) continue;
              
              // 检查是否是编辑标记
              const editMatch = commentText.match(/^\[phabdash-edit:(\d+)\]\s*\n([\s\S]*)$/);
              if (editMatch) {
                const targetId = editMatch[1];
                const editedText = (editMatch[2] || '').trim();
                editedContent.set(targetId, editedText);
                hiddenTransactionIds.add(String(transaction.id));
                continue;
              }
              
              // 检查是否是删除标记
              const deleteMatch = commentText.match(/^\[phabdash-delete:(\d+)\]\s*\n/);
              if (deleteMatch) {
                const targetId = deleteMatch[1];
                deletedTransactionIds.add(targetId);
                hiddenTransactionIds.add(String(transaction.id));
                continue;
              }
            }
            
            // 第二遍：添加未被删除的评论，应用编辑内容
            for (const transaction of transactions) {
              const commentText = transaction?.comments?.[0]?.content?.raw || '';
              if (!commentText.trim()) continue;
              
              const transactionId = String(transaction.id);
              
              // 跳过被删除的评论和标记本身
              if (deletedTransactionIds.has(transactionId) || hiddenTransactionIds.has(transactionId)) {
                continue;
              }

              scheduleCommentsFound++;

              if (transaction.authorPHID) {
                userPHIDs.add(transaction.authorPHID);
              }

              // 使用编辑后的内容（如果有）或原始内容
              const finalContent = editedContent.get(transactionId) || commentText;

              comments.push({
                id: transaction.id || Math.random(),
                author: 'Unknown',
                authorPHID: transaction.authorPHID || '',
                content: finalContent,
                timestamp: new Date((transaction.dateCreated || 0) * 1000).toLocaleString('zh-CN'),
                dateCreated: transaction.dateCreated || 0,
              });
            }
            
            // 如果成功获取到 Schedule 事务（即使没有评论），也标记为成功，避免 fallback 到任务评论
            source = 'schedule';
          }
        } catch (e: any) {
        }
      } else {
      }

      if (scheduleCommentsFound === 0 && !schedulePHID) {
        // 优先使用 Schedule PHID（通过 schedule.edit 获取），否则用项目 PHID
        const feedCandidates = schedulePHID 
          ? [schedulePHID] 
          : [String(projectPHID)];

        const onFeedError = (err: unknown, context: { params: any }) => {
          const msg = err instanceof Error ? err.message : String(err);
          feedErrors.push(msg);
        };

        let stories = [
          ...(await tryQueryFeed(client, { filterPHIDs: feedCandidates, limit: 100, view: 'text' }, onFeedError)),
          ...(await tryQueryFeed(client, { filterPHIDs: feedCandidates, limit: 100, view: 'html-summary' }, onFeedError)),
        ];

        if (stories.length > 0) {
          feedQueryMode = 'filtered';
        }

        const uniq: any[] = [];
        const seen = new Set<string>();
        for (const s of stories) {
          const k = String(s?.id ?? s?.phid ?? JSON.stringify(s)?.slice(0, 80));
          if (seen.has(k)) continue;
          seen.add(k);
          uniq.push(s);
        }

        feedStoriesTotal = uniq.length;

        // 如果 filterPHIDs 查不到 story，兜底：拉最近全站 feed，再按项目标识过滤。
        // 说明：这是为了不依赖 schedule 对象 PHID（导出数据里拿不到）。
        if (feedStoriesTotal === 0) {
          const globalStories = [
            ...(await tryQueryFeed(client, { limit: 200, view: 'text' }, onFeedError)),
            ...(await tryQueryFeed(client, { limit: 200, view: 'html-summary' }, onFeedError)),
          ];

          const globalUniq: any[] = [];
          const globalSeen = new Set<string>();
          for (const s of globalStories) {
            const k = String(s?.id ?? s?.phid ?? JSON.stringify(s)?.slice(0, 80));
            if (globalSeen.has(k)) continue;
            globalSeen.add(k);
            globalUniq.push(s);
          }

          feedQueryMode = globalUniq.length > 0 ? 'global' : 'none';
          feedStoriesTotal = globalUniq.length;

          const projectHint = String(projectName || '').trim();
          const uriHint = String(scheduleUriPath || '').trim();
          const monoHint = String(scheduleMonogram || '').trim();

          const filteredByProject = globalUniq.filter((story) => {
            const text = extractFeedStoryText(story);
            if (!text) return false;
            if (projectHint && text.includes(projectHint)) return true;
            if (monoHint && text.includes(monoHint)) return true;
            if (uriHint && text.includes(uriHint)) return true;
            return false;
          });


          uniq.length = 0;
          uniq.push(...filteredByProject);
        }

        for (const story of uniq) {
          const text = extractFeedStoryText(story);
          if (!text.trim()) continue;

          if (keywordRegex.test(text) || /添加了一条进度汇报/.test(text)) {
            feedProgressFound++;
          }

          const authorPHID =
            (typeof story?.authorPHID === 'string' && story.authorPHID) ||
            (typeof story?.authorPHID === 'string' && story.authorPHID) ||
            '';
          if (authorPHID) userPHIDs.add(authorPHID);

          const epoch =
            (typeof story?.epoch === 'number' && story.epoch) ||
            (typeof story?.dateCreated === 'number' && story.dateCreated) ||
            0;
          const storyId = typeof story?.id === 'number' ? story.id : epoch || Math.random();

          comments.push({
            id: storyId,
            author: 'Unknown',
            authorPHID,
            content: text,
            timestamp: new Date(epoch * 1000).toLocaleString('zh-CN'),
            dateCreated: epoch,
          });
          feedCommentsFound++;
        }

        if (feedProgressFound > 0) {
          source = 'feed';
        }
      }
    } catch (e: any) {
      // schedule.export.all failed, will use task comments fallback
    }

    // fallback：如果 schedule 上拿不到任何评论，再从项目下任务评论兜底
    if (scheduleCommentsFound === 0 && feedProgressFound === 0 && tasks.length > 0) {
      const taskSlice = tasks.slice(0, 30);

      for (const task of taskSlice) {
        const taskPHID = task.phid;
        const taskId = task.id;

        if (!taskPHID) continue;

        try {
          const transactionsResult = await client.call<any>('transaction.search', {
            objectIdentifier: taskPHID,
            limit: 100,
          });

          const transactions = transactionsResult?.data || [];
          if (!Array.isArray(transactions) || transactions.length === 0) continue;

          for (const transaction of transactions) {
            const commentText = transaction?.comments?.[0]?.content?.raw || '';
            if (!commentText.trim()) continue;

            if (transaction.authorPHID) {
              userPHIDs.add(transaction.authorPHID);
            }

            comments.push({
              id: transaction.id || Math.random(),
              author: 'Unknown',
              authorPHID: transaction.authorPHID || '',
              content: commentText,
              timestamp: new Date((transaction.dateCreated || 0) * 1000).toLocaleString('zh-CN'),
              dateCreated: transaction.dateCreated || 0,
            });
          }
        } catch (error: any) {
          // task transaction.search failed
        }
      }
    }

    if (comments.length === 0 && scheduleSnapshot) {
      comments.push(scheduleSnapshot);
      source = 'schedule';
    }

    // 如果是从 Schedule 获取的评论，直接返回所有评论，不做关键词过滤
    // 如果是从任务获取的评论，则进行关键词过滤
    let returned = comments;
    let filteredCount = comments.length;
    if (source === 'task') {
      const filteredComments = comments.filter((c) => keywordRegex.test(c.content));
      returned = filteredComments.length > 0 ? filteredComments : comments;
      filteredCount = filteredComments.length;
    }

    res.setHeader('X-Project-Tasks-Count', String(tasks.length));
    res.setHeader('X-Comments-Total', String(comments.length));
    res.setHeader('X-Comments-Filtered', String(filteredCount));
    res.setHeader('X-Comments-Returned', String(returned.length));
    res.setHeader('X-Comments-Source', source);
    res.setHeader('X-Feed-Stories-Total', String(feedStoriesTotal));
    res.setHeader('X-Feed-Matched', String(feedProgressFound));
    res.setHeader('X-Feed-Query-Mode', feedQueryMode);
    res.setHeader('X-Schedule-PHID', schedulePHID || 'none');
    res.setHeader('X-Schedule-Monogram', scheduleMonogram || 'none');
    if (feedErrors.length > 0) {
      res.setHeader('X-Feed-Errors', String(feedErrors.length));
      res.setHeader('X-Feed-Error', feedErrors[0].slice(0, 200));
    } else {
      res.setHeader('X-Feed-Errors', '0');
    }

    // Fetch user info for all authors
    if (userPHIDs.size > 0) {
      try {
        const usersResult = await client.call<any>('user.search', {
          constraints: {
            phids: Array.from(userPHIDs),
          },
        });

        const userMap: Record<string, string> = {};
        if (usersResult.data) {
          usersResult.data.forEach((user: any) => {
            userMap[user.phid] = user.fields.realName || user.fields.username;
          });
        }

        // Update author names
        comments.forEach(comment => {
          if (comment.authorPHID && userMap[comment.authorPHID]) {
            comment.author = userMap[comment.authorPHID];
          }
        });
      } catch (userError) {
        console.error('Failed to fetch user info:', userError);
      }
    }

    // Sort by date (newest first)
    returned.sort((a, b) => b.dateCreated - a.dateCreated);


    // Return all comments
    res.status(200).json(returned);
  } catch (error: any) {
    console.error('Error fetching project comments:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch project comments' });
  }
}
