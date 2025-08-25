import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../entities/product.entity';
import { ProductType } from '../../entities/product-type.entity';
import { ProductSubtype } from '../../entities/product-subtype.entity';
import { ProductSubtypeRelation } from '../../entities/product-subtype-relation.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(ProductType)
    private productTypeRepository: Repository<ProductType>,
    @InjectRepository(ProductSubtype)
    private productSubtypeRepository: Repository<ProductSubtype>,
    @InjectRepository(ProductSubtypeRelation)
    private productSubtypeRelationRepository: Repository<ProductSubtypeRelation>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productRepository.create(createProductDto);
    return this.productRepository.save(product);
  }

  async findAll(): Promise<Product[]> {
    return this.productRepository.find();
  }

  async findOne(id: number): Promise<Product> {
    return this.productRepository.findOne({ where: { id } });
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    await this.productRepository.update(id, updateProductDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.productRepository.delete(id);
  }

  async searchProducts(query: string): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .where('product.productName ILIKE :query', { query: `%${query}%` })
      .orWhere('product.productDescription ILIKE :query', {
        query: `%${query}%`,
      })
      .orWhere('product.productSKU ILIKE :query', { query: `%${query}%` })
      .getMany();
  }

  async findByType(productType: number): Promise<Product[]> {
    return this.productRepository.find({ where: { productType } });
  }

  // Product Type methods
  async createProductType(createProductTypeDto: any): Promise<ProductType> {
    const productType = this.productTypeRepository.create(createProductTypeDto);
    return this.productTypeRepository.save(productType);
  }

  async findAllProductTypes(): Promise<ProductType[]> {
    return this.productTypeRepository.find();
  }

  async findOneProductType(id: number): Promise<ProductType> {
    return this.productTypeRepository.findOne({ where: { id } });
  }

  async updateProductType(
    id: number,
    updateProductTypeDto: any,
  ): Promise<ProductType> {
    await this.productTypeRepository.update(id, updateProductTypeDto);
    return this.findOneProductType(id);
  }

  async removeProductType(id: number): Promise<void> {
    await this.productTypeRepository.delete(id);
  }

  // Product Subtype methods
  async createProductSubtype(
    createProductSubtypeDto: any,
  ): Promise<ProductSubtype> {
    const productSubtype = this.productSubtypeRepository.create(
      createProductSubtypeDto,
    );
    return this.productSubtypeRepository.save(productSubtype);
  }

  async findAllProductSubtypes(): Promise<ProductSubtype[]> {
    return this.productSubtypeRepository.find();
  }

  async findProductSubtypesByType(
    productTypeId: number,
  ): Promise<ProductSubtype[]> {
    return this.productSubtypeRepository.find({ where: { productTypeId } });
  }

  async findOneProductSubtype(id: number): Promise<ProductSubtype> {
    return this.productSubtypeRepository.findOne({ where: { id } });
  }

  async updateProductSubtype(
    id: number,
    updateProductSubtypeDto: any,
  ): Promise<ProductSubtype> {
    await this.productSubtypeRepository.update(id, updateProductSubtypeDto);
    return this.findOneProductSubtype(id);
  }

  async removeProductSubtype(id: number): Promise<void> {
    await this.productSubtypeRepository.delete(id);
  }

  // Product Subtype Relation methods
  async addProductSubtypeRelation(
    productId: number,
    subtypeId: number,
  ): Promise<ProductSubtypeRelation> {
    const relation = this.productSubtypeRelationRepository.create({
      productId,
      subtypeId,
    });
    return this.productSubtypeRelationRepository.save(relation);
  }

  async getProductSubtypeRelations(
    productId: number,
  ): Promise<ProductSubtypeRelation[]> {
    return this.productSubtypeRelationRepository.find({ where: { productId } });
  }

  async removeProductSubtypeRelation(
    productId: number,
    subtypeId: number,
  ): Promise<void> {
    await this.productSubtypeRelationRepository.delete({
      productId,
      subtypeId,
    });
  }

  async removeAllProductSubtypeRelations(productId: number): Promise<void> {
    await this.productSubtypeRelationRepository.delete({ productId });
  }
}
