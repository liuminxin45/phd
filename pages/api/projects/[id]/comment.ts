import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; message?: string; error?: string }>
) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }

    const { id } = req.query;
    const { content, scheduleMonogram, transactionId, action } = req.body;

    // 判断操作类型
    const isDelete = req.method === 'DELETE' || action === 'delete';
    const isEdit = action === 'edit';

    if (!isDelete && !isEdit && (!content || typeof content !== 'string' || !content.trim())) {
      return res.status(400).json({ success: false, error: '评论内容不能为空' });
    }

    if ((isDelete || isEdit) && !transactionId) {
      return res.status(400).json({ success: false, error: '缺少 transactionId 参数' });
    }

    if (isEdit && (!content || typeof content !== 'string' || !content.trim())) {
      return res.status(400).json({ success: false, error: '编辑内容不能为空' });
    }

    const client = new ConduitClient(host, token);

    // 如果提供了 scheduleMonogram，直接用它发送评论
    let objectIdentifier = scheduleMonogram;

    // 如果没有提供 monogram，尝试从 schedule.export.all 获取
    if (!objectIdentifier) {
      const scheduleResult = await client.call<any>('schedule.export.all', {
        objectType: 'project',
        formatKey: 'json',
      });

      if (scheduleResult?.['download URI']) {
        const resp = await fetch(scheduleResult['download URI']);
        if (resp.ok) {
          const jsonData = await resp.json();
          const scheduleData = Array.isArray(jsonData) ? jsonData : (jsonData?.data || []);
          
          // 查找匹配的 schedule 记录
          const record = scheduleData.find((item: any) => {
            const uri = item.uri || item.projectUrl || item.url;
            if (typeof uri === 'string' && uri.includes(`/project/schedule/${id}/`)) return true;
            return false;
          });

          if (record?.monogram) {
            objectIdentifier = record.monogram;
          }
        }
      }
    }

    if (!objectIdentifier) {
      return res.status(400).json({ 
        success: false, 
        error: '无法找到对应的 Schedule 对象，请确保项目已关联 Schedule' 
      });
    }

    // 从 monogram 中提取数字 ID (SC8054 -> 8054)
    let scheduleProjectId = objectIdentifier;
    if (objectIdentifier.match(/^SC(\d+)$/i)) {
      const match = objectIdentifier.match(/^SC(\d+)$/i);
      if (match?.[1]) {
        scheduleProjectId = match[1];
      }
    }

    // 使用 schedule.edit 发送评论、编辑标记或删除标记
    let commentValue: string;
    let successMessage: string;
    
    if (isDelete) {
      // 删除评论：发送一个带有删除标记的新评论
      commentValue = `[phabdash-delete:${transactionId}]\nThis comment has been deleted.`;
      successMessage = '评论删除成功';
    } else if (isEdit) {
      // 编辑评论：发送一个带有编辑标记的新评论
      commentValue = `[phabdash-edit:${transactionId}]\n${content.trim()}`;
      successMessage = '评论编辑成功';
    } else {
      // 新增评论
      commentValue = content.trim();
      successMessage = '评论发送成功';
    }

    const result = await client.call<any>('schedule.edit', {
      objectIdentifier: scheduleProjectId,
      transactions: [
        { type: 'comment', value: commentValue }
      ],
    });

    if (result?.object?.phid) {
      return res.status(200).json({ 
        success: true, 
        message: successMessage 
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: `${successMessage.replace('成功', '失败')}，请稍后重试` 
      });
    }
  } catch (error: any) {
    console.error('Error sending comment:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || '发送评论时发生错误' 
    });
  }
}
