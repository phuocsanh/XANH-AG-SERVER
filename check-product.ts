
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ProductService } from './src/modules/product/product.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const productService = app.get(ProductService);
  
  const productId = 94;
  console.log(`Checking product ${productId}...`);
  const product = await productService.findOne(productId);
  
  if (product) {
    console.log(`Product Name: ${product.name}`);
    console.log(`Quantity (Raw): ${product.quantity}`);
    console.log(`Quantity Type: ${typeof product.quantity}`);
  } else {
    console.log('Product not found.');
  }
  
  await app.close();
}

bootstrap();
