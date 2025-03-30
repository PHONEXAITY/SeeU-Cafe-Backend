import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import {
  UploadApiOptions,
  UploadApiResponse,
  TransformationOptions,
} from 'cloudinary';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

@Injectable()
export class CloudinaryService {
  async uploadFile(
    file: MulterFile,
    folder: string = 'seeu-cafe',
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
        } as UploadApiOptions,
        (error, result) => {
          if (error) return reject(new Error(error.message || 'Upload failed'));
          resolve(result as UploadApiResponse);
        },
      );

      const fileStream = new Readable();
      fileStream.push(file.buffer);
      fileStream.push(null);
      fileStream.pipe(uploadStream);
    });
  }

  async deleteFile(publicId: string): Promise<UploadApiResponse> {
    return cloudinary.uploader.destroy(publicId) as Promise<UploadApiResponse>;
  }

  createImageUrl(
    publicId: string,
    options: TransformationOptions = {},
  ): string {
    return cloudinary.url(publicId, options);
  }
}
