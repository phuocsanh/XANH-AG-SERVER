/**
 * Interface cho kết quả dự báo thời tiết
 * Bao gồm thông tin mưa bão, mực nước, và video YouTube
 */
export interface WeatherForecastResult {
  /** Tóm tắt tình hình thời tiết hiện tại */
  summary: string;

  /** Thông tin về mưa bão */
  hydrologyInfo: string;

  /** Thông tin mực nước Đồng bằng sông Cửu Long */
  waterLevelInfo: string;

  /** Dự báo thời tiết 10 ngày tới */
  stormsAndTropicalDepressionsInfo: string;

  /** Danh sách video YouTube về dự báo thời tiết */
  youtubeVideos: YouTubeVideoData[];

  /** Thời gian cập nhật */
  lastUpdated: string;

  /** Nguồn dữ liệu */
  dataSources: string[];
}

/**
 * Interface cho dữ liệu video YouTube
 */
export interface YouTubeVideoData {
  /** ID video YouTube */
  id: string;
  /** Tiêu đề video */
  title: string;
  /** URL video YouTube */
  url: string;
  /** URL ảnh thumbnail */
  thumbnail: string;
  /** Thông tin kênh */
  channel: {
    /** Tên kênh */
    name: string;
    /** URL kênh */
    url?: string;
  };
  /** Thời lượng video */
  duration?: string;
  /** Số lượt xem */
  views?: string;
  /** Thời gian upload */
  uploadTime?: string;
  /** Mô tả ngắn */
  description?: string;
}

/**
 * Interface cho kết quả tìm kiếm YouTube videos
 */
export interface YouTubeSearchResult {
  /** Danh sách video tìm được */
  videos: YouTubeVideoData[];

  /** Từ khóa tìm kiếm */
  query: string;

  /** Thời gian tìm kiếm */
  searchTime: string;

  /** Tổng số video tìm được */
  totalResults: number;

  /** Thông tin chất lượng tìm kiếm (tùy chọn) */
  searchQuality?: {
    /** Có video gần đây không */
    hasRecentVideos: boolean;
    /** Số video có từ "hôm nay" */
    todayVideosCount: number;
    /** Điểm chất lượng (0-100) */
    score: number;
  };

  /** Thông báo lỗi nếu có (tùy chọn) */
  error?: string;
}

/**
 * Interface cho kết quả tìm kiếm web
 */
export interface WebSearchResult {
  /** Tiê đề */
  title: string;
  /** Đoạn trích */
  snippet: string;
  /** URL */
  url: string;
  /** Nguồn */
  source: string;
  /** Ngày đăng */
  publishedDate?: string;
  /** Độ liên quan */
  relevanceScore: number;
}

/**
 * Interface cho yêu cầu phân tích thời tiết
 */
export interface WeatherAnalysisRequest {
  /** Khu vực cần phân tích */
  region?: string;
  /** Thời gian phân tích */
  timeRange?: 'current' | '3days' | '7days' | '10days';
  /** Có lấy video YouTube không */
  includeYouTube?: boolean;
  /** Số lượng video tối đa */
  maxVideos?: number;
}
