import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRoleDto: CreateRoleDto) {
    const existingRole = await this.prisma.role.findUnique({
      where: { name: createRoleDto.name },
    });

    if (existingRole) {
      throw new ConflictException(
        `Role with name '${createRoleDto.name}' already exists`,
      );
    }

    return this.prisma.role.create({
      data: createRoleDto,
    });
  }

  async findAll() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  async findByName(name: string) {
    const role = await this.prisma.role.findUnique({
      where: { name },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with name '${name}' not found`);
    }

    return role;
  }

  async update(id: number, updateRoleDto: UpdateRoleDto) {
    await this.findOne(id);

    if (updateRoleDto.name) {
      const existingRole = await this.prisma.role.findUnique({
        where: { name: updateRoleDto.name },
      });

      if (existingRole && existingRole.id !== id) {
        throw new ConflictException(
          `Role with name '${updateRoleDto.name}' already exists`,
        );
      }
    }

    return this.prisma.role.update({
      where: { id },
      data: updateRoleDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.role.delete({
      where: { id },
    });

    return { message: 'Role deleted successfully' };
  }

  async assignRoleToUser(userId: number, roleId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Check if user already has this role
    if (user.role_id === roleId) {
      throw new ConflictException(`User already has the role '${role.name}'`);
    }

    // Update user's role_id
    await this.prisma.user.update({
      where: { id: userId },
      data: { role_id: roleId },
    });

    return { message: `Role '${role.name}' assigned to user successfully` };
  }

  async removeRoleFromUser(userId: number, roleId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Check if user has this role
    if (user.role_id !== roleId) {
      throw new NotFoundException(`User does not have the role '${role.name}'`);
    }

    // Remove role by setting role_id to null
    await this.prisma.user.update({
      where: { id: userId },
      data: { role_id: null },
    });

    return { message: `Role '${role.name}' removed from user successfully` };
  }

  async getUserRoles(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Return the single role (or null if no role)
    return user.role ? [user.role] : [];
  }

  async hasRole(userId: number, roleName: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || !user.role) {
      return false;
    }

    return user.role.name === roleName;
  }
}
