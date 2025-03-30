// src/roles/roles.service.ts
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
    // Check if role with the same name already exists
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
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: number) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        users: {
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
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with name '${name}' not found`);
    }

    return role;
  }

  async update(id: number, updateRoleDto: UpdateRoleDto) {
    // Check if role exists
    await this.findOne(id);

    // If name is being updated, check if the new name is already in use
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
    // Check if role exists
    await this.findOne(id);

    // Delete the role
    await this.prisma.role.delete({
      where: { id },
    });

    return { message: 'Role deleted successfully' };
  }

  async assignRoleToUser(userId: number, roleId: number) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if role exists
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Check if user already has this role
    const existingAssignment = await this.prisma.userRole.findUnique({
      where: {
        user_id_role_id: {
          user_id: userId,
          role_id: roleId,
        },
      },
    });

    if (existingAssignment) {
      throw new ConflictException(`User already has the role '${role.name}'`);
    }

    // Assign the role
    await this.prisma.userRole.create({
      data: {
        user_id: userId,
        role_id: roleId,
      },
    });

    return { message: `Role '${role.name}' assigned to user successfully` };
  }

  async removeRoleFromUser(userId: number, roleId: number) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if role exists
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Check if user has this role
    const existingAssignment = await this.prisma.userRole.findUnique({
      where: {
        user_id_role_id: {
          user_id: userId,
          role_id: roleId,
        },
      },
    });

    if (!existingAssignment) {
      throw new NotFoundException(`User does not have the role '${role.name}'`);
    }

    // Remove the role
    await this.prisma.userRole.delete({
      where: {
        user_id_role_id: {
          user_id: userId,
          role_id: roleId,
        },
      },
    });

    return { message: `Role '${role.name}' removed from user successfully` };
  }

  async getUserRoles(userId: number) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get user roles
    const userRoles = await this.prisma.userRole.findMany({
      where: { user_id: userId },
      include: {
        role: true,
      },
    });

    return userRoles.map((ur) => ur.role);
  }

  async hasRole(userId: number, roleName: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: {
        user_id: userId,
        role: {
          name: roleName,
        },
      },
    });

    return count > 0;
  }
}
