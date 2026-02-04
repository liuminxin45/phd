import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

interface DeleteMilestoneRequest {
  milestonePHID: string; // Milestone PHID (e.g., PHID-MILE-xxx)
}

interface SuccessResponse {
  success: true;
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
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error: missing PHA_HOST or PHA_TOKEN' 
      });
    }

    const body: DeleteMilestoneRequest = req.body;
    const { milestonePHID } = body;

    if (!milestonePHID) {
      return res.status(400).json({ success: false, error: 'milestonePHID is required' });
    }

    // Phabricator Conduit API does not have a schedule.milestone.delete method
    // You need to implement this API in your Phabricator backend first
    return res.status(501).json({
      success: false,
      error: 'Milestone deletion is not supported. The Phabricator Conduit API does not provide a schedule.milestone.delete method. Please implement this API in your Phabricator backend or use the web interface to delete milestones.',
    });
  } catch (error: any) {
    console.error('Error deleting milestone:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      details: error,
    });
  }
}
