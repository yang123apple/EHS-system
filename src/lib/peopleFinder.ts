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
   * 递归查找部门的主管（向上查找父部门）
   * @param deptId - 部门ID
   * @param excludeUserId - 要排除的用户ID（避免返回自己）
   * @returns 主管用户对象，如果未找到则返回null
   */
  private static async findManagerRecursive(
    deptId: string | null,
    excludeUserId?: string
  ): Promise<User | null> {
    if (!deptId) return null;

    const dept = await prisma.department.findUnique({
      where: { id: deptId },
      select: {
        managerId: true,
        parentId: true,
      },
    });

    if (!dept) return null;

    // 如果当前部门有主管，且不是要排除的用户，返回该主管
    if (dept.managerId && dept.managerId !== excludeUserId) {
      const manager = await prisma.user.findUnique({
        where: { id: dept.managerId },
      });
      if (manager) return manager;
    }

    // 如果当前部门没有主管，或者是用户自己，递归向上查找父部门
    if (dept.parentId) {
      return this.findManagerRecursive(dept.parentId, excludeUserId);
    }

    return null;
  }

  /**
   * Find the supervisor of a specific user.
   * Logic:
   * 1. Check directManagerId first (if schema supported it fully, assuming business logic first).
   * 2. Find manager of user's department recursively (go up the hierarchy if needed).
   * 3. If manager.id != user.id, return manager.
   * 4. If manager.id == user.id, find parent department's manager recursively.
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

    // 2. 递归查找部门层级中的主管
    return this.findManagerRecursive(user.departmentId, userId);
  }

  /**
   * 查找用户的直接主管ID（directManagerId）
   * 如果用户没有设置 directManagerId，则通过递归查找部门层级来确定
   * @param userId - 用户ID
   * @returns 主管的用户ID，如果未找到则返回null
   */
  static async findDirectManagerId(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        directManagerId: true,
        departmentId: true,
      },
    });

    if (!user) return null;

    // 如果已经设置了 directManagerId，直接返回
    if (user.directManagerId) {
      // 验证该主管是否存在
      const manager = await prisma.user.findUnique({
        where: { id: user.directManagerId },
        select: { id: true },
      });
      if (manager) return user.directManagerId;
    }

    // 如果没有设置 directManagerId，通过递归查找部门层级来确定
    if (!user.departmentId) return null;

    const supervisor = await this.findManagerRecursive(user.departmentId, userId);
    return supervisor?.id || null;
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
