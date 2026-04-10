import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

export class QueryHelper {
  /**
   * Áp dụng các logic search cơ bản: Pagination, Sorting, Keyword Search
   */
  /**
   * Làm sạch từ khóa tìm kiếm: chuẩn hóa NFC, trim và bỏ các ký tự đặc biệt (giữ lại chữ cái Unicode/tiếng Việt và số)
   */
  static sanitizeKeyword(keyword: any): string {
    if (!keyword) return '';
    return String(keyword)
      .trim()
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}\s]/gu, '');
  }

  /**
   * Áp dụng điều kiện tìm kiếm mờ (fuzzy) cho một field: unaccent + bỏ ký tự đặc biệt
   * Trả về chuỗi điều kiện để dùng trong query.andWhere()
   */
  static applyFuzzyCondition<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    field: string,
    keyword: string,
    paramName: string = 'fuzzyKeyword'
  ): string {
    const sanitized = this.sanitizeKeyword(keyword);
    query.setParameter(paramName, `%${sanitized}%`);
    return `regexp_replace(unaccent(${field}::text), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:${paramName})`;
  }

  /**
   * Áp dụng các logic search cơ bản: Pagination, Sorting, Keyword Search
   */
  static applyBaseSearch<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    dto: any,
    alias: string,
    searchFields: string[] = [],
  ) {
    // 1. Phân trang
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 10;
    const skip = (page - 1) * limit;
    
    query.skip(skip).take(limit);

    // 2. Sắp xếp (Sort)
    if (dto.sort) {
      const field = dto.sort.split(':')[0];
      const order = dto.sort.split(':')[1];
      if (field) {
         const sortField = field.includes('.') ? field : `${alias}.${field}`;
         const sortOrder = (order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
         query.orderBy(sortField, sortOrder);
      }
    }
    else if (dto.sort_by) {
      // Cho phép sort theo relations
      const sortField = dto.sort_by.includes('.') ? dto.sort_by : `${alias}.${dto.sort_by}`;
      const sortOrder = dto.sort_order === 'ASC' ? 'ASC' : 'DESC';
      query.orderBy(sortField, sortOrder);
    } else {
      // Default sort
      query.orderBy(`${alias}.created_at`, 'DESC');
    }

    // 3. Global Search (Keyword)
    if (dto.keyword && searchFields.length > 0) {
      const sanitizedKeyword = this.sanitizeKeyword(dto.keyword);
      const searchTerms = sanitizedKeyword.toLowerCase();
      
      // 3.1. Thêm điều kiện tìm kiếm cụm từ nguyên bản (ưu tiên)
      // Sử dụng fuzzy logic: unaccent + bỏ ký tự đặc biệt nhưng GIỮ LẠI khoảng trắng
      const phraseConditions = searchFields.map((field, fIndex) => {
        const col = field.includes('.') ? field : `${alias}.${field}`;
        const pName = `phrase_search_${fIndex}`;
        query.setParameter(pName, `%${searchTerms}%`);
        // Giữ lại khoảng trắng trong regex để khớp cụm từ
        return `regexp_replace(unaccent(${col}::text), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:${pName})`;
      });

      // 3.2. Tách từ khóa thành các tokens để tìm kiếm linh hoạt (AND logic)
      const tokens = searchTerms.split(/\s+/).filter(t => t.length > 0);

      if (tokens.length > 1) {
        // Nếu có nhiều hơn 1 từ, kết hợp cả tìm kiếm cụm từ HOẶC tất cả các từ xuất hiện
        const tokenQueries: string[] = [];
        tokens.forEach((token, tIndex) => {
          const conditions = searchFields.map((field, fIndex) => {
            const col = field.includes('.') ? field : `${alias}.${field}`;
            const pName = `global_search_${tIndex}_${fIndex}`;
            query.setParameter(pName, `%${token}%`);
            return `regexp_replace(unaccent(${col}::text), '[^a-zA-Z0-9\\s]', '', 'g') ILIKE unaccent(:${pName})`;
          });
          tokenQueries.push(`(${conditions.join(' OR ')})`);
        });
        
        // Kết hợp: (Khớp nguyên cụm từ) OR (Khớp tất cả các từ đơn lẻ)
        query.andWhere(`((${phraseConditions.join(' OR ')}) OR (${tokenQueries.join(' AND ')}))`);
      } else if (tokens.length === 1) {
        // Chỉ có 1 từ
        query.andWhere(`(${phraseConditions.join(' OR ')})`);
      }
    }

    // 4. Date Range Search
    if (dto.start_date) {
      query.andWhere(`${alias}.created_at >= :startDate`, {
        startDate: dto.start_date,
      });
    }
    if (dto.end_date) {
      query.andWhere(`${alias}.created_at <= :endDate`, {
        endDate: dto.end_date,
      });
    }

    return { page, limit, skip };
  }

  /**
   * Tự động filter theo các field có trong DTO (Object phẳng)
   */
  static applyFilters<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    dto: any,
    alias: string,
    ignoreFields: string[] = [],
    fieldMapping: Record<string, string> = {}
  ) {
    const reservedFields = ['page', 'limit', 'keyword', 'sort', 'sort_by', 'sort_order', 'filters', 'customer_term', 'nested_filters', 'operator', 'start_date', 'end_date', ...ignoreFields];
    
    Object.keys(dto).forEach(key => {
      // Bỏ qua reserved fields hoặc giá trị null/undefined/empty
      if (reservedFields.includes(key) || dto[key] === undefined || dto[key] === null || dto[key] === '') {
        return;
      }

      const value = dto[key];
      
      // Determine field name based on mapping or default alias
      let field = fieldMapping[key];
      if (!field) {
         field = key.includes('.') ? key : `${alias}.${key}`;
      }
      
      const paramName = key.replace(/\.|:/g, '_'); // Replace dots and colons
      
      if (Array.isArray(value)) {
        // Xử lý array: sử dụng IN operator
        query.andWhere(`${field} IN (:...${paramName})`, { [paramName]: value });
      } else if (typeof value === 'string') {
        // Enums (like status) don't support ILIKE in Postgres
        if (key === 'status' || key === 'payment_status' || field.endsWith('.status') || field.endsWith('.payment_status') || key === 'type' || field.endsWith('.type')) {
          query.andWhere(`${field}::text = :${paramName}`, { [paramName]: value });
        } else {
          // Sử dụng logic fuzzy chung từ method static
          const condition = this.applyFuzzyCondition(query, field, value, `filter_${paramName}`);
          query.andWhere(condition);
        }
      } else {
        query.andWhere(`${field} = :${paramName}`, { [paramName]: value });
      }
    });
  }
}
