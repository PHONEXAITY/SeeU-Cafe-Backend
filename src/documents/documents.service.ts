import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { Document } from '@prisma/client';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(createDocumentDto: CreateDocumentDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: createDocumentDto.user_id },
    });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${createDocumentDto.user_id} not found`,
      );
    }

    return this.prisma.document.create({
      data: {
        ...createDocumentDto,
        uploaded_at: new Date(),
      },
    });
  }

  async findByEmployeeId(employeeId: number): Promise<Document[]> {
    const documents = await this.prisma.document.findMany({
      where: { employee_id: employeeId },
      orderBy: { uploaded_at: 'desc' },
    });

    if (!documents || documents.length === 0) {
      throw new NotFoundException(
        `No documents found for employee ID ${employeeId}`,
      );
    }

    return documents;
  }

  async findAll() {
    return this.prisma.document.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        uploaded_at: 'desc',
      },
    });
  }

  async uploadDocument(
    file: Express.Multer.File,
    options: {
      documentType: string;
      userId?: number;
      employeeId?: number;
    },
  ) {
    if (!options.userId && !options.employeeId) {
      throw new BadRequestException(
        'Either userId or employeeId must be provided',
      );
    }

    const result = await this.cloudinaryService.uploadFile(file, 'documents');

    return this.prisma.document.create({
      data: {
        document_type: options.documentType,
        user_id: options.userId,
        employee_id: options.employeeId,
        file_path: result.secure_url,
      },
    });
  }

  async findByUserId(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.document.findMany({
      where: { user_id: userId },
      orderBy: {
        uploaded_at: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    return document;
  }

  async update(id: number, updateDocumentDto: UpdateDocumentDto) {
    await this.findOne(id);

    if (updateDocumentDto.user_id) {
      const user = await this.prisma.user.findUnique({
        where: { id: updateDocumentDto.user_id },
      });

      if (!user) {
        throw new NotFoundException(
          `User with ID ${updateDocumentDto.user_id} not found`,
        );
      }
    }

    return this.prisma.document.update({
      where: { id },
      data: updateDocumentDto,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  async remove(id: number) {
    const document = await this.findOne(id);

    if (
      document.file_path.includes('cloudinary') &&
      document.file_path.includes('/upload/')
    ) {
      try {
        const urlParts = document.file_path.split('/');
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split('.')[0];

        await this.cloudinaryService.deleteFile(publicId).catch(() => {
          console.log(`Could not delete file from Cloudinary: ${publicId}`);
        });
      } catch (error) {
        console.error('Error extracting Cloudinary public ID:', error);
      }
    }

    await this.prisma.document.delete({
      where: { id },
    });

    return { message: 'Document deleted successfully' };
  }

  async downloadDocument(id: number) {
    const document = await this.findOne(id);

    if (!document || !document.file_path) {
      throw new NotFoundException('Document not found or has no file path');
    }

    return {
      url: document.file_path,
      filename: this.getFilenameFromUrl(document.file_path),
      documentType: document.document_type,
    };
  }

  private getFilenameFromUrl(url: string): string {
    try {
      const urlParts = url.split('/');
      return urlParts[urlParts.length - 1];
    } catch (error) {
      console.error(error.message);
      return `document-${Date.now()}.pdf`;
    }
  }
}
