/**
 * Interface cho kết quả phân tích thị trường lúa gạo
 * Dựa trên mẫu từ riceAnalysisService.ts để đảm bảo tính nhất quán
 */
export interface RiceAnalysisResult {
  /** Tóm tắt tình hình thị trường lúa gạo hiện tại */
  summary: string;
  
  /** Thông tin giá cả các loại lúa gạo (tùy chọn) */
  priceData?: {
    /** Giá lúa tươi (VNĐ/kg) */
    freshRice: string;
    /** Giá gạo xuất khẩu (USD/tấn) */
    exportRice: string;
    /** Giá gạo trong nước (VNĐ/kg) */
    domesticRice: string;
    /** Xu hướng giá hiện tại */
    trend: 'tăng' | 'giảm' | 'ổn định';
  };
  
  /** Danh sách các giống lúa với giá cụ thể theo từng tỉnh thành */
  riceVarieties: {
    /** Tên giống lúa (ví dụ: ST25, IR504, ĐT8, Jasmine, Nàng Hương) */
    variety: string;
    /** Giá hiện tại (ví dụ: 9.200 đồng/kg, 5.000-5.100 đồng/kg) */
    currentPrice: string;
    /** Giá hôm qua để so sánh (nếu có) */
    previousPrice?: string;
    /** Thay đổi giá (tăng/giảm/không đổi) */
    change?: string;
    /** Tỉnh thành (ví dụ: Sóc Trăng, An Giang, Đồng Tháp, Kiên Giang) */
    province: string;
  }[];
  
  /** Các thông tin quan trọng và insights về thị trường */
  marketInsights: string[];
  
  /** Thời gian cập nhật dữ liệu */
  lastUpdated: string;
  
  /** Thông tin chất lượng dữ liệu (tùy chọn) */
  dataQuality?: {
    /** Số bảng giá tìm thấy */
    tablesFound: number;
    /** Số giá được trích xuất */
    pricesExtracted: number;
    /** Có thông tin ngày không */
    hasDate: boolean;
    /** Mức độ hoàn thiện dữ liệu */
    completeness: 'high' | 'medium' | 'low';
    /** Điểm chất lượng (0-100) */
    score: number;
  };
  
  /** URL nguồn dữ liệu (tùy chọn) */
  sourceUrl?: string;
  
  /** Danh sách các nguồn bổ sung từ web search (tùy chọn) */
  additionalSources?: string[];
}

/**
 * Interface cho dữ liệu đầu vào phân tích
 */
export interface AnalyzeRiceMarketRequest {
  /** URL cần phân tích (tùy chọn, mặc định sẽ lấy từ congthuong.vn) */
  url?: string;
  
  /** Có bao gồm phân tích chi tiết không */
  includeDetailedAnalysis?: boolean;
  
  /** Ngôn ngữ trả về kết quả */
  language?: 'vi' | 'en';
}

/**
 * Interface cho dữ liệu video YouTube về giá lúa gạo
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
  
  /** Thời lượng video (định dạng: "MM:SS" hoặc "HH:MM:SS") */
  duration?: string;
  
  /** Số lượt xem */
  views?: string;
  
  /** Thời gian upload (ví dụ: "2 ngày trước", "1 tuần trước") */
  uploadTime?: string;
  
  /** Mô tả ngắn video */
  description?: string;
  
  /** Có phải video live không */
  isLive?: boolean;
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