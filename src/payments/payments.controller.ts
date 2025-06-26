import {
  Controller,
  Get,
  Post,
  Res,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  StreamableFile,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { join } from 'path';
import * as fs from 'fs';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadPaymentProofDto } from './dto/upload-payment-proof.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new payment' })
  @ApiResponse({ status: 201, description: 'Payment created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order or delivery not found' })
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(createPaymentDto);
  }

  @Post('upload-proof')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload payment proof' })
  @ApiResponse({
    status: 201,
    description: 'Payment proof uploaded successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        payment_id: { type: 'integer' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/payment-proofs',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = extname(file.originalname);
          cb(null, `payment-proof-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadPaymentProof(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadPaymentProofDto,
  ) {
    return this.paymentsService.uploadPaymentProof(uploadDto.payment_id, file);
  }

  @Post('with-proof')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment with proof' })
  @ApiResponse({
    status: 201,
    description: 'Payment created with proof successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        order_id: { type: 'integer' },
        amount: { type: 'number' },
        method: { type: 'string' },
        status: { type: 'string' },
        notes: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['order_id', 'amount', 'method', 'file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/payment-proofs',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = extname(file.originalname);
          cb(null, `payment-proof-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async createPaymentWithProof(
    @UploadedFile() file: Express.Multer.File,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return this.paymentsService.createWithProof(createPaymentDto, file);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all payments' })
  @ApiQuery({
    name: 'orderId',
    required: false,
    description: 'Filter by order ID',
  })
  @ApiResponse({ status: 200, description: 'List of payments' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query('orderId') orderId?: string) {
    return this.paymentsService.findAll(orderId ? +orderId : undefined);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(+id);
  }
  @Get(':id/proof-image')
  async getPaymentProofImage(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payment = await this.paymentsService.findOne(+id);

    if (!payment || !payment.payment_proof) {
      throw new NotFoundException('Payment proof not found');
    }

    const filePath = join(process.cwd(), payment.payment_proof);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Payment proof file not found');
    }

    const fileName = payment.payment_proof.split('/').pop() || '';
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    const mimeTypes = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      pdf: 'application/pdf',
    };

    res.set({
      'Content-Type':
        mimeTypes[ext as keyof typeof mimeTypes] || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${fileName}"`,
    });

    const file = createReadStream(filePath);
    return new StreamableFile(file);
  }

  @Get(':id/proof-download')
  async downloadPaymentProof(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payment = await this.paymentsService.findOne(+id);

    if (!payment || !payment.payment_proof) {
      throw new NotFoundException('Payment proof not found');
    }

    const filePath = join(process.cwd(), payment.payment_proof);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Payment proof file not found');
    }

    const fileName = payment.payment_proof.split('/').pop() || '';
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    const mimeTypes = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      pdf: 'application/pdf',
    };

    res.set({
      'Content-Type':
        mimeTypes[ext as keyof typeof mimeTypes] || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });

    const file = createReadStream(filePath);
    return new StreamableFile(file);
  }

  @Get(':id/proof')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment proof' })
  @ApiResponse({ status: 200, description: 'Payment proof details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment proof not found' })
  async getPaymentProof(@Param('id') id: string) {
    return this.paymentsService.getPaymentProof(+id);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve payment (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment approved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async approvePayment(@Param('id') id: string) {
    return this.paymentsService.approvePayment(+id);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject payment (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment rejected successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', example: 'Invalid payment proof' },
      },
    },
  })
  async rejectPayment(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.paymentsService.rejectPayment(+id, reason);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a payment' })
  @ApiResponse({ status: 200, description: 'Payment updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return this.paymentsService.update(+id, updatePaymentDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update payment status' })
  @ApiResponse({
    status: 200,
    description: 'Payment status updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'completed', 'failed', 'refunded'],
          example: 'completed',
        },
      },
      required: ['status'],
    },
  })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.paymentsService.updateStatus(+id, status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a payment (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(+id);
  }
}
