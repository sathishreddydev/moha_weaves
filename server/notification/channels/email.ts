import * as nodemailer from 'nodemailer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  NotificationChannel,
  NotificationError,
  ChannelNotAvailableError,
  TemplateNotFoundError
} from '../types';

export interface EmailConfig {
  enabled: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: {
    name: string;
    email: string;
  };
  templatesPath: string;
}

export interface EmailMessage {
  template?: string;
  subject: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  content?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  data?: Record<string, any>;
}

export class EmailChannel {
  private config: EmailConfig;
  private transporter: nodemailer.Transporter | null = null;

  constructor(config: EmailConfig) {
    this.config = config;
    this.initializeTransporter();
  }

  /**
   * Initialize nodemailer transporter
   */
  private async initializeTransporter(): Promise<void> {
    if (!this.config.enabled) {
      console.log('📧 Email channel is disabled');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: this.config.smtp.secure,
        auth: {
          user: this.config.smtp.auth.user,
          pass: this.config.smtp.auth.pass
        }
      });

      // Verify connection
      if (this.transporter) {
        await this.transporter.verify();
        console.log('📧 Email transporter initialized successfully');
      }

    } catch (error) {
      console.error('❌ Failed to initialize email transporter:', error);
      this.transporter = null;
    }
  }

  /**
   * Send email notification
   */
  async send(message: EmailMessage): Promise<void> {
    if (!this.config.enabled || !this.transporter) {
      throw new ChannelNotAvailableError(NotificationChannel.EMAIL);
    }

    try {
      // Load template if specified
      let htmlContent = message.content;
      let textContent = message.content;

      if (message.template) {
        try {
          const template = await this.loadTemplate(message.template);
          htmlContent = template.html;
          textContent = template.text;
        } catch (error) {
          console.warn(`Template ${message.template} not found, using content`);
        }
      }

      // Replace template variables
      if (message.data) {
        if (htmlContent) {
          htmlContent = this.replaceVariables(htmlContent, message.data);
        }
        if (textContent) {
          textContent = this.replaceVariables(textContent, message.data);
        }
        if (message.subject) {
          message.subject = this.replaceVariables(message.subject, message.data);
        }
      }

      // Prepare email options
      const mailOptions = {
        from: `"${this.config.from.name}" <${this.config.from.email}>`,
        to: message.to.filter(email => email).join(', '),
        cc: message.cc?.filter(email => email).join(', '),
        bcc: message.bcc?.filter(email => email).join(', '),
        subject: message.subject,
        html: htmlContent,
        text: textContent,
        attachments: message.attachments
      };

      // Send email
      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`📧 Email sent successfully: ${result.messageId}`);
      console.log(`   To: ${(message.to || []).join(', ')}`);
      console.log(`   Subject: ${message.subject || 'No subject'}`);

    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw new NotificationError(
        `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EMAIL_SEND_FAILED',
        500,
        { error, message }
      );
    }
  }

  /**
   * Send email to single recipient
   */
  async sendToSingle(
    to: string,
    subject: string,
    content: string,
    options?: {
      template?: string;
      data?: Record<string, any>;
      cc?: string[];
      bcc?: string[];
      attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType?: string;
      }>;
    }
  ): Promise<void> {
    return this.send({
      template: options?.template,
      subject,
      to: [to],
      content,
      cc: options?.cc,
      bcc: options?.bcc,
      attachments: options?.attachments,
      data: options?.data
    });
  }

  /**
   * Send bulk emails
   */
  async sendBulk(messages: EmailMessage[]): Promise<{ success: number; failed: number; errors: any[] }> {
    const results = { success: 0, failed: 0, errors: [] as any[] };

    for (const message of messages) {
      try {
        await this.send(message);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ message: message.to.join(', '), error });
      }
    }

    console.log(`📧 Bulk email completed: ${results.success} sent, ${results.failed} failed`);
    return results;
  }

  /**
   * Load email template from file
   */
  private async loadTemplate(templateName: string): Promise<{ html: string; text: string }> {
    try {
      const templatePath = path.join(this.config.templatesPath, templateName);
      
      const htmlPath = path.join(templatePath, 'template.html');
      const textPath = path.join(templatePath, 'template.txt');

      const [htmlContent, textContent] = await Promise.all([
        fs.readFile(htmlPath, 'utf-8').catch(() => ''),
        fs.readFile(textPath, 'utf-8').catch(() => '')
      ]);

      if (!htmlContent && !textContent) {
        throw new TemplateNotFoundError(templateName, NotificationChannel.EMAIL);
      }

      return {
        html: htmlContent || this.generateTextToHtml(textContent),
        text: textContent || this.htmlToText(htmlContent)
      };

    } catch (error) {
      console.error(`❌ Failed to load email template ${templateName}:`, error);
      throw new TemplateNotFoundError(templateName, NotificationChannel.EMAIL);
    }
  }

  /**
   * Replace template variables
   */
  private replaceVariables(content: string, data: Record<string, any>): string {
    if (!content || !data) return content;

    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(data, key);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Convert plain text to basic HTML
   */
  private generateTextToHtml(text: string): string {
    return text
      .split('\n')
      .map(line => `<p>${line || '&nbsp;'}</p>`)
      .join('');
  }

  /**
   * Convert HTML to plain text (basic)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email connection test failed:', error);
      return false;
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail(to: string): Promise<void> {
    const testMessage: EmailMessage = {
      template: 'test',
      subject: 'Test Email from Notification System',
      to: [to],
      data: {
        timestamp: new Date().toISOString(),
        systemName: 'Inventory Notification System'
      }
    };

    await this.send(testMessage);
  }

  /**
   * Get email statistics
   */
  async getStats(): Promise<{
    enabled: boolean;
    configured: boolean;
    lastTest?: Date;
  }> {
    return {
      enabled: this.config.enabled,
      configured: !!this.transporter,
      lastTest: undefined // Would be stored in database
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('📧 Shutting down email channel...');
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
  }
}
