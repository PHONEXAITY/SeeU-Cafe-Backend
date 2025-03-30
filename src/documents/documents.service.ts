import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

// Define a MulterFile interface to use instead of Express.Multer.File
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer: Buffer;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(createDocumentDto: CreateDocumentDto) {
    // Check if user exists
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

  async uploadDocument(
    file: MulterFile, // Changed from Express.Multer.File to our custom MulterFile
    userId: number,
    documentType: string,
  ) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Upload file to Cloudinary
    const result = await this.cloudinaryService.uploadFile(file, 'documents');

    // Create document in database
    return this.prisma.document.create({
      data: {
        user_id: userId,
        document_type: documentType,
        file_path: result.secure_url,
        uploaded_at: new Date(),
      },
    });
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

  async findByUserId(userId: number) {
    // Check if user exists
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
    // Check if document exists
    await this.findOne(id);

    // If user_id is being updated, check if the new user exists
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
    // Check if document exists and get file path
    const document = await this.findOne(id);

    // Extract public ID from Cloudinary URL if applicable
    // Example URL: https://res.cloudinary.com/cloud-name/image/upload/v1234567890/public-id.jpg
    if (
      document.file_path.includes('cloudinary') &&
      document.file_path.includes('/upload/')
    ) {
      try {
        const urlParts = document.file_path.split('/');
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split('.')[0]; // Remove file extension

        // Delete from Cloudinary (this is optional and can fail silently)
        await this.cloudinaryService.deleteFile(publicId).catch(() => {
          console.log(`Could not delete file from Cloudinary: ${publicId}`);
        });
      } catch (error) {
        console.error('Error extracting Cloudinary public ID:', error);
      }
    }

    // Delete from database
    await this.prisma.document.delete({
      where: { id },
    });

    return { message: 'Document deleted successfully' };
  }
}
