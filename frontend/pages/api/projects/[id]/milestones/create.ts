import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

interface CreateMilestoneRequest {
  scheduleId: number; // e.g., 8054 from SC8054
  milestoneName: string;
  bindItem: string; // PHID-IALL-xxx
  preMilestone?: string | string[]; // PHID-MILE-xxx or array (optional)
  estimateFinishDate?: number; // Unix timestamp
  updateFinishDate?: number; // Unix timestamp
  actualFinishDate?: number; // Unix timestamp
}

interface SuccessResponse {
  success: true;
  milestone: {
    id: number;
    phid: string;
  };
  message: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }

    const body: CreateMilestoneRequest = req.body;
    const {
      scheduleId,
      milestoneName,
      bindItem,
      preMilestone,
      estimateFinishDate,
      updateFinishDate,
      actualFinishDate,
    } = body;

    if (!scheduleId || typeof scheduleId !== 'number') {
      return res.status(400).json({ success: false, error: 'scheduleId (number) is required' });
    }
    if (!milestoneName) {
      return res.status(400).json({ success: false, error: 'milestoneName is required' });
    }
    if (!bindItem) {
      return res.status(400).json({ success: false, error: 'bindItem (PHID-IALL-xxx) is required' });
    }

    const client = new ConduitClient(host, token);

    // Create milestone with required fields
    // Note: schedule.milestone.create requires bindItem and milestoneName
    const createParams: Record<string, any> = {
      scheduleID: scheduleId,
      milestoneName: milestoneName,
      bindItem: bindItem,
    };

    if (preMilestone) {
      // Ensure preMilestone is always an array as required by the API
      createParams.preMilestone = Array.isArray(preMilestone) ? preMilestone : [preMilestone];
    }

    if (estimateFinishDate) {
      createParams.estimateFinishDate = estimateFinishDate;
    }

    if (updateFinishDate) {
      createParams.updateFinishDate = updateFinishDate;
    }

    if (actualFinishDate) {
      createParams.actualFinishDate = actualFinishDate;
    }

    const createResult = await client.call<{
      object: { id: number; phid: string };
      transactions: Array<{ phid: string }>;
    }>('schedule.milestone.create', createParams);

    const newMilestoneId = createResult?.object?.id;
    const newMilestonePHID = createResult?.object?.phid;

    if (!newMilestoneId || !newMilestonePHID) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create milestone',
        details: createResult,
      });
    }

    return res.status(200).json({
      success: true,
      milestone: {
        id: newMilestoneId,
        phid: newMilestonePHID,
      },
      message: 'Milestone created successfully',
    });
  } catch (error: any) {
    console.error('Error creating milestone:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      details: error,
    });
  }
}
