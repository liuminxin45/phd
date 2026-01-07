import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { scheduleId, milestonePhids } = req.body;

    if (!scheduleId || !Array.isArray(milestonePhids)) {
      return res.status(400).json({ error: 'Missing scheduleId or milestonePhids' });
    }

    // Call Phabricator's reorder API
    // Note: This is a direct HTTP POST to Phabricator, not a Conduit API
    const phabricatorHost = process.env.PHABRICATOR_HOST || 'http://pha.tp-link.com.cn';
    const token = process.env.PHABRICATOR_API_TOKEN;

    // Construct form data
    const formData = new URLSearchParams();
    formData.append('keyOrder', milestonePhids.join(','));
    formData.append('__submit__', 'true');
    formData.append('__wflow__', 'true');
    formData.append('__ajax__', 'true');

    const response = await fetch(`${phabricatorHost}/schedule/project/reorder/${scheduleId}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `phusr=${process.env.PHABRICATOR_USER || ''}; phsid=${process.env.PHABRICATOR_SESSION || ''}`,
      },
      body: formData.toString(),
    });

    const result = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Phabricator reorder failed: ${response.statusText}`,
        details: result,
      });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Milestones reordered successfully',
    });
  } catch (error: any) {
    console.error('Error reordering milestones:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
    });
  }
}
