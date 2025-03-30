import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({
    description: 'User ID',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({
    description: 'Role ID',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  roleId: number;
}
