import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

export class QueryHelper {
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
      const [field, order] = dto.sort.split(':');
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
      const conditions = searchFields.map(field => {
        const col = field.includes('.') ? field : `${alias}.${field}`;
        return `${col} ILIKE :keyword`;
      });
      
      query.andWhere(`(${conditions.join(' OR ')})`, { keyword: `%${dto.keyword}%` });
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
        if (key === 'status' || key === 'payment_status' || field.endsWith('.status') || field.endsWith('.payment_status')) {
          query.andWhere(`${field}::text = :${paramName}`, { [paramName]: value });
        } else {
          query.andWhere(`${field} ILIKE :${paramName}`, {
            [paramName]: `%${value}%`,
          });
        }
      } else {
        query.andWhere(`${field} = :${paramName}`, { [paramName]: value });
      }
    });
  }
}
