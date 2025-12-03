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
  private cachedKeys: Map<number, { key: string; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 giờ

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
      this.logger.log('✅ Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error(`❌ Failed to initialize Firebase: ${error}`);
      this.logger.warn('⚠️ Will fallback to .env GOOGLE_AI_API_KEY');
    }
  }

  /**
   * Lấy API Key Gemini từ Remote Config hoặc .env (fallback)
   */
  async getGeminiApiKey(): Promise<string> {
    return this.getGeminiApiKeyByIndex(1);
  }

  /**
   * Lấy API Key Gemini theo index (1-7) từ Firebase Remote Config
   * Key names: ABC_GEMINI_API_KEY_1, ABC_GEMINI_API_KEY_2, ..., ABC_GEMMINI_API_KEY_4 (typo), ...
   */
  async getGeminiApiKeyByIndex(keyIndex: number): Promise<string> {
    // Validate index
    if (keyIndex < 1 || keyIndex > 7) {
      throw new Error(`Invalid keyIndex: ${keyIndex}. Must be between 1-7`);
    }

    // 1. Kiểm tra cache
    const now = Date.now();
    const cached = this.cachedKeys.get(keyIndex);
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      return cached.key;
    }

    // 2. Thử lấy từ Firebase Remote Config
    if (this.remoteConfig) {
      try {
        const template = await this.remoteConfig.getTemplate();
        
        // DEBUG: Log danh sách các key có trong template
        const availableKeys = Object.keys(template.parameters);
        this.logger.log(`📋 Available keys in Remote Config: ${availableKeys.join(', ')}`);
        
        // Key name mapping
        const keyName = `GEMINI_API_KEY_${keyIndex}`;

        const parameter = template.parameters[keyName];
        
        if (parameter && parameter.defaultValue) {
          const apiKey = (parameter.defaultValue as any).value as string;
          
          if (apiKey) {
            // Cache key
            this.cachedKeys.set(keyIndex, { key: apiKey, timestamp: now });
            this.logger.log(`✅ Got Gemini API Key #${keyIndex} from Firebase Remote Config: ${apiKey.substring(0, 10)}...`);
            return apiKey;
          } else {
            this.logger.warn(`⚠️ Key ${keyName} exists but value is empty`);
          }
        } else {
            this.logger.warn(`⚠️ Key ${keyName} not found in template parameters`);
        }
        
      } catch (error) {
        this.logger.warn(`⚠️ Failed to fetch key #${keyIndex} from Remote Config: ${error}`);
      }
    } else {
      this.logger.error('❌ Firebase Remote Config is not initialized!');
    }

    throw new Error(`Could not retrieve API Key #${keyIndex} from Firebase Remote Config. Please check Firebase Console.`);
  }

  /**
   * Xóa cache để force refresh từ Remote Config
   */
  clearCache() {
    this.cachedKeys.clear();
    this.logger.log('🔄 Cache cleared');
  }
}
