import { prisma } from '@/lib/prisma';
import { User } from '@prisma/client';

export type UserStrategy =
  | 'specific_user'
  | 'dept_manager'
  | 'user_dept_manager'
  | 'supervisor'
  | 'specific_role'
  | 'dept_role';

export interface PeopleFinderResult {
  users: User[];
  meta?: Record<string, unknown>;
}

export class PeopleFinder {
  /**
   * Find a specific user by ID.
   */
  static async findUserById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  }

  /**
   * Find the manager of a specific department.
   */
  static async findDeptManager(deptId: string): Promise<User | null> {
    const dept = await prisma.department.findUnique({
      where: { id: deptId },
      select: { managerId: true },
    });

    if (dept?.managerId) {
      return prisma.user.findUnique({
        where: { id: dept.managerId },
      });
    }
    return null;
  }

  /**
   * Find the manager of the department the user belongs to.
   */
  static async findUserDeptManager(userId: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });

    if (user?.departmentId) {
      return this.findDeptManager(user.departmentId);
    }
    return null;
  }

  /**
   * Find the supervisor of a specific user.
   * Logic:
   * 1. Check directManagerId first (if schema supported it fully, assuming business logic first).
   * 2. Find manager of user's department.
   * 3. If manager.id != user.id, return manager.
   * 4. If manager.id == user.id, find parent department's manager.
   */
  static async findSupervisor(userId: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    // 1. Direct Manager Override
    if (user.directManagerId) {
      const directManager = await prisma.user.findUnique({
        where: { id: user.directManagerId },
      });
      if (directManager) return directManager;
    }

    if (!user.departmentId) return null;

    // 2. Department Manager
    const dept = await prisma.department.findUnique({
      where: { id: user.departmentId },
      include: { parent: true },
    });

    if (!dept) return null;

    if (dept.managerId && dept.managerId !== userId) {
      return prisma.user.findUnique({ where: { id: dept.managerId } });
    }

    // 3. Parent Department Manager (if user is the manager of current dept)
    if (dept.parentId) {
      // Logic: If user is manager, go up. Or if no manager set, go up?
      // Requirement says: "if consistent (manager == user), find parent dept id..."
      if (dept.parentId) {
          const parentDept = await prisma.department.findUnique({
              where: { id: dept.parentId }
          });
          if (parentDept?.managerId) {
              return prisma.user.findUnique({ where: { id: parentDept.managerId } });
          }
      }
    }

    return null;
  }

  /**
   * Find users with a specific job title in a specific department.
   */
  static async findByJobTitle(deptId: string, title: string): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        departmentId: deptId,
        jobTitle: {
          contains: title,
        },
      },
    });
  }

  /**
   * Find users by job title across the whole company (optional helper)
   */
  static async findByJobTitleGlobal(title: string): Promise<User[]> {
      return prisma.user.findMany({
          where: {
              jobTitle: { contains: title }
          }
      })
  }

  /**
   * Find department manager by department name.
   */
  static async findDeptManagerByName(deptName: string): Promise<User[]> {
    const dept = await prisma.department.findFirst({
      where: { name: deptName },
    });

    if (dept?.managerId) {
      const manager = await prisma.user.findUnique({
        where: { id: dept.managerId },
      });
      return manager ? [manager] : [];
    }
    return [];
  }

  /**
   * Search users by name or job title.
   */
  static async searchUsers(query: string, deptId?: string): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        AND: [
          deptId ? { departmentId: deptId } : {},
          {
            OR: [
              { name: { contains: query } },
              { username: { contains: query } },
              { jobTitle: { contains: query } },
            ],
          },
        ],
      },
      take: 20, // Limit results for performance
    });
  }
}
