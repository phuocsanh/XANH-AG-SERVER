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
    if (dto.sort_by) {
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

    return { page, limit, skip };
  }

  /**
   * Tự động filter theo các field có trong DTO (Object phẳng)
   */
  static applyFilters<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    dto: any,
    alias: string,
    ignoreFields: string[] = []
  ) {
    const reservedFields = ['page', 'limit', 'keyword', 'sort_by', 'sort_order', 'filters', 'customer_term', ...ignoreFields];
    
    Object.keys(dto).forEach(key => {
      // Bỏ qua reserved fields hoặc giá trị null/undefined/empty
      if (reservedFields.includes(key) || dto[key] === undefined || dto[key] === null || dto[key] === '') {
        return;
      }

      const value = dto[key];
      const field = key.includes('.') ? key : `${alias}.${key}`;
      const paramName = key.replace(/\./g, '_'); // Replace all dots
      
      if (Array.isArray(value)) {
        query.andWhere(`${field} IN (:...${paramName})`, { [paramName]: value });
      } else if (typeof value === 'string') {
        query.andWhere(`${field} ILIKE :${paramName}`, { [paramName]: `%${value}%` });
      } else {
        query.andWhere(`${field} = :${paramName}`, { [paramName]: value });
      }
    });
  }
}
