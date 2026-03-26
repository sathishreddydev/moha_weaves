import type { Express } from 'express';
import { WebhookService, type DelhiveryWebhookPayload } from './webhookService';

export const webhookRoutes = (app: Express) => {
  /**
   * Delhivery webhook endpoint
   * POST /api/webhooks/delhivery
   */
  app.post('/api/webhooks/delhivery', async (req, res) => {
    try {
      const signature = req.headers['x-delhivery-signature'] as string;
      const payload = req.body;

      // Log incoming webhook
      WebhookService.logWebhook('delhivery_status_update', payload, signature);

      // Verify webhook signature (optional - implement if Delhivery provides signatures)
      if (signature && !WebhookService.verifyWebhookSignature(JSON.stringify(payload), signature)) {
        console.log('🚫 Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Validate required fields
      if (!payload.waybill || !payload.status) {
        console.log('🚫 Invalid webhook payload - missing required fields');
        return res.status(400).json({ 
          error: 'Invalid payload',
          required: ['waybill', 'status']
        });
      }

      // Process the webhook
      await WebhookService.handleDelhiveryStatusUpdate(payload);

      // Return success response
      res.status(200).json({ 
        success: true,
        message: 'Webhook processed successfully',
        processed_at: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Webhook processing failed:', error);
      
      // Return error response but don't retry indefinitely
      res.status(500).json({ 
        success: false,
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Generic webhook endpoint for testing
   * POST /api/webhooks/test
   */
  app.post('/api/webhooks/test', async (req, res) => {
    try {
      const { event, payload } = req.body;

      console.log('🧪 Test webhook received:', { event, payload });

      // Process test webhook
      await WebhookService.processWebhook(event, payload);

      res.status(200).json({
        success: true,
        message: 'Test webhook processed successfully',
        processed_at: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Test webhook processing failed:', error);
      res.status(500).json({
        success: false,
        error: 'Test webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Webhook health check
   * GET /api/webhooks/health
   */
  app.get('/api/webhooks/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'webhook-service',
      timestamp: new Date().toISOString(),
      endpoints: [
        'POST /api/webhooks/delhivery',
        'POST /api/webhooks/test',
        'GET /api/webhooks/health'
      ]
    });
  });

  /**
   * Webhook configuration info
   * GET /api/webhooks/config
   */
  app.get('/api/webhooks/config', (req, res) => {
    res.status(200).json({
      webhook_url: `${req.protocol}://${req.get('host')}/api/webhooks/delhivery`,
      supported_events: [
        'status_update',
        'pickup_scheduled', 
        'delivery_exception'
      ],
      expected_payload_format: {
        waybill: 'string (required)',
        order_id: 'string (optional)',
        status: 'string (required)',
        status_code: 'string (optional)',
        status_datetime: 'string (ISO format)',
        location: 'string (optional)',
        remarks: 'string (optional)',
        edd: 'string (optional - estimated delivery date)',
        additional_info: 'object (optional)'
      },
      headers: {
        'Content-Type': 'application/json',
        'X-Delhivery-Signature': 'string (optional - HMAC signature)'
      }
    });
  });
};
