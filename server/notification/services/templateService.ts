import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  NotificationTemplate,
  NotificationChannel,
  TemplateNotFoundError
} from '../types';

export interface RenderedTemplate {
  subject?: string;
  content: string;
  html?: string;
  text?: string;
}

export class TemplateService {
  private templates: Map<string, NotificationTemplate> = new Map();
  private templatesPath: string;

  constructor() {
    this.templatesPath = process.env.NOTIFICATION_TEMPLATES_PATH || './server/notification/templates';
    console.log('📄 Template service initialized');
  }

  /**
   * Initialize template service
   */
  async initialize(): Promise<void> {
    try {
      await this.loadAllTemplates();
      console.log(`📄 Loaded ${this.templates.size} notification templates`);
    } catch (error) {
      console.error('❌ Failed to initialize template service:', error);
      throw error;
    }
  }

  /**
   * Get template for event and channel
   */
  async getTemplate(
    event: string, 
    channel: NotificationChannel, 
    language: string = 'en'
  ): Promise<NotificationTemplate> {
    const templateKey = `${event}:${channel}:${language}`;
    let template = this.templates.get(templateKey);

    // Try fallback to English if specific language not found
    if (!template && language !== 'en') {
      template = this.templates.get(`${event}:${channel}:en`);
    }

    // Try fallback to default template for event
    if (!template) {
      template = this.templates.get(`${event}:default`);
    }

    if (!template) {
      throw new TemplateNotFoundError(templateKey, channel);
    }

    return template;
  }

  /**
   * Render template with data
   */
  async renderTemplate(
    template: NotificationTemplate, 
    data: Record<string, any>
  ): Promise<RenderedTemplate> {
    try {
      const rendered: RenderedTemplate = {
        content: this.replaceVariables(template.content, data)
      };

      if (template.subject) {
        rendered.subject = this.replaceVariables(template.subject, data);
      }

      // For email templates, return both HTML and text
      if (template.channel === NotificationChannel.EMAIL) {
        const htmlContent = await this.loadEmailTemplate(template.name, 'html');
        const textContent = await this.loadEmailTemplate(template.name, 'text');
        
        if (htmlContent) {
          rendered.html = this.replaceVariables(htmlContent, data);
        }
        if (textContent) {
          rendered.text = this.replaceVariables(textContent, data);
        }
      }

      return rendered;

    } catch (error) {
      console.error('❌ Failed to render template:', error);
      throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load all templates from filesystem
   */
  private async loadAllTemplates(): Promise<void> {
    try {
      const channelDirs = ['email', 'sms', 'push', 'in_app'];
      
      for (const channelDir of channelDirs) {
        const channelPath = path.join(this.templatesPath, channelDir);
        
        try {
          const eventDirs = await fs.readdir(channelPath);
          
          for (const eventDir of eventDirs) {
            await this.loadEventTemplates(channelDir, eventDir);
          }
        } catch (error) {
          // Channel directory might not exist
          console.log(`📄 Channel ${channelDir} templates not found`);
        }
      }

    } catch (error) {
      console.error('❌ Failed to load templates:', error);
    }
  }

  /**
   * Load templates for specific event
   */
  private async loadEventTemplates(channel: string, event: string): Promise<void> {
    const eventPath = path.join(this.templatesPath, channel, event);
    
    try {
      const files = await fs.readdir(eventPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          await this.loadTemplateFile(channel, event, file);
        }
      }
    } catch (error) {
      console.log(`📄 No templates found for ${channel}/${event}`);
    }
  }

  /**
   * Load template from JSON file
   */
  private async loadTemplateFile(channel: string, event: string, filename: string): Promise<void> {
    try {
      const filePath = path.join(this.templatesPath, channel, event, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const templateData = JSON.parse(content);

      // Extract language from filename (e.g., template.en.json -> en)
      const languageMatch = filename.match(/\.([a-z]{2})\.json$/);
      const language = languageMatch ? languageMatch[1] : 'en';

      const template: NotificationTemplate = {
        id: `${event}:${channel}:${language}`,
        name: templateData.name || `${event}_${channel}`,
        channel: channel as NotificationChannel,
        language,
        subject: templateData.subject,
        content: templateData.content,
        variables: templateData.variables || [],
        isActive: templateData.isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.templates.set(template.id, template);
      
    } catch (error) {
      console.error(`❌ Failed to load template ${filename}:`, error);
    }
  }

  /**
   * Load email template file (HTML or text)
   */
  private async loadEmailTemplate(templateName: string, type: 'html' | 'text'): Promise<string | null> {
    try {
      const templatePath = path.join(this.templatesPath, 'email', templateName, `template.${type}`);
      return await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
      return null;
    }
  }

  /**
   * Replace template variables
   */
  private replaceVariables(content: string, data: Record<string, any>): string {
    if (!content || !data) return content;

    return content.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
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
   * Create new template
   */
  async createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate> {
    const newTemplate: NotificationTemplate = {
      ...template,
      id: `${template.name}:${template.channel}:${template.language}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.templates.set(newTemplate.id, newTemplate);
    
    // Save to filesystem
    await this.saveTemplateToFile(newTemplate);
    
    console.log(`📄 Created template: ${newTemplate.id}`);
    return newTemplate;
  }

  /**
   * Update existing template
   */
  async updateTemplate(
    id: string, 
    updates: Partial<Omit<NotificationTemplate, 'id' | 'createdAt'>>
  ): Promise<NotificationTemplate> {
    const existing = this.templates.get(id);
    if (!existing) {
      throw new TemplateNotFoundError(id, NotificationChannel.EMAIL);
    }

    const updated: NotificationTemplate = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    this.templates.set(id, updated);
    await this.saveTemplateToFile(updated);
    
    console.log(`📄 Updated template: ${id}`);
    return updated;
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string): Promise<boolean> {
    const template = this.templates.get(id);
    if (!template) return false;

    this.templates.delete(id);
    
    // Remove from filesystem
    await this.deleteTemplateFile(template);
    
    console.log(`📄 Deleted template: ${id}`);
    return true;
  }

  /**
   * Get all templates
   */
  async getAllTemplates(): Promise<NotificationTemplate[]> {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by channel
   */
  async getTemplatesByChannel(channel: NotificationChannel): Promise<NotificationTemplate[]> {
    return Array.from(this.templates.values()).filter(t => t.channel === channel);
  }

  /**
   * Get templates by event
   */
  async getTemplatesByEvent(event: string): Promise<NotificationTemplate[]> {
    return Array.from(this.templates.values()).filter(t => t.name.includes(event));
  }

  /**
   * Save template to file
   */
  private async saveTemplateToFile(template: NotificationTemplate): Promise<void> {
    try {
      const [eventName] = template.name.split('_');
      const channelPath = path.join(this.templatesPath, template.channel, eventName);
      
      // Ensure directory exists
      await fs.mkdir(channelPath, { recursive: true });
      
      const filePath = path.join(channelPath, `template.${template.language}.json`);
      const templateData = {
        name: template.name,
        subject: template.subject,
        content: template.content,
        variables: template.variables,
        isActive: template.isActive
      };
      
      await fs.writeFile(filePath, JSON.stringify(templateData, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to save template to file:', error);
    }
  }

  /**
   * Delete template file
   */
  private async deleteTemplateFile(template: NotificationTemplate): Promise<void> {
    try {
      const [eventName] = template.name.split('_');
      const filePath = path.join(
        this.templatesPath, 
        template.channel, 
        eventName, 
        `template.${template.language}.json`
      );
      
      await fs.unlink(filePath);
      
    } catch (error) {
      console.error('❌ Failed to delete template file:', error);
    }
  }

  /**
   * Validate template data
   */
  validateTemplateData(template: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.name) errors.push('Template name is required');
    if (!template.channel) errors.push('Channel is required');
    if (!template.language) errors.push('Language is required');
    if (!template.content) errors.push('Content is required');

    if (template.channel === NotificationChannel.EMAIL && !template.subject) {
      errors.push('Subject is required for email templates');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Preview template with sample data
   */
  async previewTemplate(
    templateId: string, 
    sampleData?: Record<string, any>
  ): Promise<RenderedTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new TemplateNotFoundError(templateId, NotificationChannel.EMAIL);
    }

    // Use sample data or default sample data
    const data = sampleData || this.getDefaultSampleData(template.name);
    
    return this.renderTemplate(template, data);
  }

  /**
   * Get default sample data for preview
   */
  private getDefaultSampleData(eventName: string): Record<string, any> {
    const baseData = {
      notificationId: 'preview-123',
      timestamp: new Date().toISOString(),
      userName: 'John Doe',
      userEmail: 'john@example.com'
    };

    const eventSpecificData: Record<string, Record<string, any>> = {
      'STOCK_REQUEST_CREATED': {
        requestId: 'REQ-001',
        productName: 'Sample Product',
        quantity: 10,
        storeName: 'Main Store',
        requestedBy: 'Jane Smith'
      },
      'ORDER_SHIPPED': {
        orderId: 'ORD-001',
        trackingNumber: 'TRACK-123',
        carrier: 'UPS',
        estimatedDelivery: '2024-01-15'
      },
      'LOW_STOCK_ALERT': {
        productName: 'Sample Product',
        currentStock: 5,
        threshold: 10,
        storeLocation: 'Main Store'
      }
    };

    const eventKey = Object.keys(eventSpecificData).find(key => eventName.includes(key.toLowerCase()));
    
    return {
      ...baseData,
      ...(eventKey ? eventSpecificData[eventKey] : {})
    };
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(): Promise<{
    total: number;
    byChannel: Record<NotificationChannel, number>;
    byLanguage: Record<string, number>;
    active: number;
    inactive: number;
  }> {
    const templates = Array.from(this.templates.values());
    
    const stats = {
      total: templates.length,
      byChannel: {} as Record<NotificationChannel, number>,
      byLanguage: {} as Record<string, number>,
      active: templates.filter(t => t.isActive).length,
      inactive: templates.filter(t => !t.isActive).length
    };

    // Count by channel
    Object.values(NotificationChannel).forEach(channel => {
      stats.byChannel[channel] = templates.filter(t => t.channel === channel).length;
    });

    // Count by language
    templates.forEach(template => {
      stats.byLanguage[template.language] = (stats.byLanguage[template.language] || 0) + 1;
    });

    return stats;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('📄 Shutting down template service...');
    this.templates.clear();
  }
}
