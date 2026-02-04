import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

/**
 * Milestone Edit API
 * 
 * 【API 说明】
 * 使用 schedule.milestone.edit API 编辑里程碑字段
 * 
 * 【有效的事务类型】
 * - milestoneName: 里程碑名称
 * - preMilestone: 前置里程碑
 * - taskID: 任务ID
 * - syncTaskTime: 同步任务时间
 * - updateFinishDate: 更新完成日期
 * - actualFinishDate: 实际完成日期
 * - delayGroup: 延期团队
 * - delayName-{团队}: 延期原因（产品/软件/硬件/测试/结构/ISP/算法/采购/生产/CAD/其它/历史存档）
 * - delayResp: 延期责任方
 * - delayDesc: 延期描述
 * - subscribers.add/remove/set: 订阅者管理
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { 
      milePHID, 
      milestoneName,
      preMilestone,
      bindItem,
      updateFinishDate,
      actualFinishDate,
      delayGroup,
      delayReason,
      delayDesc
    } = req.body;

    if (!milePHID) {
      return res.status(400).json({ error: 'Missing milestone PHID' });
    }

    const client = new ConduitClient(host, token);

    // Build transactions array based on provided fields
    const transactions: any[] = [];

    if (milestoneName !== undefined) {
      transactions.push({ type: 'milestoneName', value: milestoneName });
    }

    if (preMilestone !== undefined) {
      // preMilestone expects a list of milestone names
      transactions.push({ type: 'preMilestone', value: preMilestone ? [preMilestone] : [] });
    }

    if (bindItem !== undefined) {
      // bindItem (绑定节点池节点) expects a single PHID-IALL string (not a list)
      transactions.push({ type: 'bindItem', value: bindItem || '' });
    }

    if (updateFinishDate !== undefined) {
      if (updateFinishDate === null) {
        // Clear the date field
        transactions.push({ type: 'updateFinishDate', value: null });
      } else {
        // Convert Date to Unix timestamp if needed
        const timestamp = typeof updateFinishDate === 'number' 
          ? updateFinishDate 
          : Math.floor(new Date(updateFinishDate).getTime() / 1000);
        transactions.push({ type: 'updateFinishDate', value: timestamp });
      }
    }

    if (actualFinishDate !== undefined) {
      if (actualFinishDate === null) {
        // Clear the date field
        transactions.push({ type: 'actualFinishDate', value: null });
      } else {
        const timestamp = typeof actualFinishDate === 'number' 
          ? actualFinishDate 
          : Math.floor(new Date(actualFinishDate).getTime() / 1000);
        transactions.push({ type: 'actualFinishDate', value: timestamp });
      }
    }

    if (delayGroup !== undefined) {
      // delayGroup expects a list, not a string
      transactions.push({ type: 'delayGroup', value: delayGroup ? [delayGroup] : [] });
    }

    // Handle delay reason - format is delayName-{团队}, expects a list
    if (delayGroup && delayReason !== undefined) {
      transactions.push({ type: `delayName-${delayGroup}`, value: delayReason ? [delayReason] : [] });
    }

    if (delayDesc !== undefined) {
      transactions.push({ type: 'delayDesc', value: delayDesc });
    }

    if (transactions.length === 0) {
      return res.status(400).json({ error: 'No changes to save' });
    }

    // Call schedule.milestone.edit API
    const result = await client.call<any>('schedule.milestone.edit', {
      objectIdentifier: milePHID,
      transactions
    });

    res.status(200).json({ 
      success: true,
      result
    });
  } catch (error: any) {
    console.error('Error updating milestone:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to update milestone' 
    });
  }
}
