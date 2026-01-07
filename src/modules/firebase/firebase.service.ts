import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

/**
 * Service để tương tác với Firebase Remote Config
 * Lấy API Key Gemini từ Remote Config thay vì hardcode trong .env
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private remoteConfig: admin.remoteConfig.RemoteConfig | null = null;
  private messaging: admin.messaging.Messaging | null = null;
  private cachedGeminiKeys: { keys: { key: string; name: string }[]; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 giờ

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      const serviceAccount = {
        projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
        clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
        privateKey: this.configService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
      };

      if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
        this.logger.warn('⚠️ Firebase credentials not configured. Will use .env GOOGLE_AI_API_KEY instead.');
        return;
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });

      this.remoteConfig = admin.remoteConfig();
      this.messaging = admin.messaging();
      this.logger.log('✅ Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error(`❌ Failed to initialize Firebase: ${error}`);
      this.logger.warn('⚠️ Will fallback to .env GOOGLE_AI_API_KEY');
    }
  }

  /**
   * Lấy danh sách tất cả API Key Gemini từ Remote Config
   */
  async getAllGeminiApiKeys(): Promise<{ key: string; name: string }[]> {
    if (!this.remoteConfig) {
      this.logger.error('❌ Firebase Remote Config is not initialized!');
      return [];
    }

    // 1. Kiểm tra cache
    const now = Date.now();
    if (this.cachedGeminiKeys && (now - this.cachedGeminiKeys.timestamp) < this.CACHE_DURATION) {
      return this.cachedGeminiKeys.keys;
    }

    try {
      const template = await this.remoteConfig.getTemplate();
      const geminiKeys: { key: string; name: string }[] = [];

      // 2. Tìm trong parameters cấp 1
      if (template.parameters) {
        Object.keys(template.parameters).forEach(key => {
          if (key.startsWith('GEMINI_API_KEY_')) {
            const val = (template.parameters[key]?.defaultValue as any)?.value;
            if (val) geminiKeys.push({ key: val, name: key });
          }
        });
      }

      // 3. Tìm trong parameterGroups
      if (template.parameterGroups) {
        Object.keys(template.parameterGroups).forEach(groupName => {
          const group = template.parameterGroups[groupName];
          if (group && group.parameters) {
            Object.keys(group.parameters).forEach(key => {
              if (key.startsWith('GEMINI_API_KEY_')) {
                const val = (group.parameters[key]?.defaultValue as any)?.value;
                if (val) geminiKeys.push({ key: val, name: key });
              }
            });
          }
        });
      }

      if (geminiKeys.length > 0) {
        this.cachedGeminiKeys = { keys: geminiKeys, timestamp: now };
        this.logger.log(`✅ Found and cached ${geminiKeys.length} Gemini API Keys from Remote Config`);
      } else {
        this.logger.warn('⚠️ No Gemini API Keys found in Remote Config parameters/groups');
      }
      
      return geminiKeys;
    } catch (error) {
      this.logger.error(`❌ Failed to fetch keys from Remote Config: ${error}`);
      return [];
    }
  }

  /**
   * Lấy API Key Gemini từ Remote Config hoặc .env (fallback)
   */
  async getGeminiApiKey(): Promise<{ key: string; name: string }> {
    const keys = await this.getAllGeminiApiKeys();
    if (keys.length > 0) {
      // Chọn ngẫu nhiên một key để phân bổ tải
      const selected = keys[Math.floor(Math.random() * keys.length)];
      if (selected) return selected;
    }
    
    // Fallback .env
    const envKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (envKey) return { key: envKey, name: 'ENV_GOOGLE_AI_API_KEY' };

    throw new Error('No Gemini API Key found in Remote Config or Environment');
  }

  /**
   * Lấy API Key Gemini theo index (Legacy support)
   */
  async getGeminiApiKeyByIndex(keyIndex: number): Promise<{ key: string; name: string }> {
    if (!this.remoteConfig) {
      this.logger.error('❌ Firebase Remote Config is not initialized!');
      return this.getGeminiApiKey(); 
    }

    try {
      const template = await this.remoteConfig.getTemplate();
      const keyName = `GEMINI_API_KEY_${keyIndex}`;

      // Thử tìm trong parameters flat
      let parameter = template.parameters?.[keyName];
      
      // Nếu không thấy, thử tìm trong các groups
      if (!parameter && template.parameterGroups) {
        for (const groupName of Object.keys(template.parameterGroups)) {
          const group = template.parameterGroups[groupName];
          if (group && group.parameters && group.parameters[keyName]) {
            parameter = group.parameters[keyName];
            break;
          }
        }
      }

      if (parameter && parameter.defaultValue) {
        const apiKey = (parameter.defaultValue as any).value as string | undefined;
        if (apiKey) return { key: apiKey, name: keyName };
      }
      
      this.logger.warn(`⚠️ Key ${keyName} not found in any Remote Config parameters or groups`);
    } catch (error) {
      this.logger.warn(`⚠️ Failed to fetch key #${keyIndex} from Remote Config: ${error}`);
    }

    // Fallback to getGeminiApiKey to at least return some key
    return this.getGeminiApiKey();
  }

  /**
   * Gửi thông báo đẩy tới một thiết bị cụ thể qua FCM
   */
  async sendPushNotification(token: string, title: string, body: string, data?: any) {
    if (!this.messaging) {
      this.logger.error('❌ Firebase Messaging is not initialized!');
      return;
    }

    try {
      const message = {
        notification: { title, body },
        token: token,
        data: data || {},
      };

      const response = await this.messaging.send(message);
      this.logger.log(`🚀 Successfully sent notification: ${response}`);
      return response;
    } catch (error) {
      this.logger.error(`❌ Error sending push notification: ${error}`);
      throw error;
    }
  }

  /**
   * Xóa cache để force refresh từ Remote Config
   */
  clearCache() {
    this.cachedGeminiKeys = null;
    this.logger.log('🔄 Cache cleared');
  }
}
