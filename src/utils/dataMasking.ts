/**
 * 数据脱敏工具函数
 * 按角色分级返回敏感信息，防止误传播
 */

/**
 * 脱敏手机号：只显示后4位
 * @param phone 手机号
 * @returns 脱敏后的手机号，如：****1234
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  if (phone.length <= 4) return '****';
  return '****' + phone.slice(-4);
}

/**
 * 脱敏身份证号：只显示后4位
 * @param idCard 身份证号
 * @returns 脱敏后的身份证号，如：****************1234
 */
export function maskIdCard(idCard: string | null | undefined): string {
  if (!idCard) return '';
  if (idCard.length <= 4) return '****************';
  return '*'.repeat(Math.max(0, idCard.length - 4)) + idCard.slice(-4);
}

/**
 * 脱敏邮箱：只显示用户名和域名，隐藏中间部分
 * @param email 邮箱
 * @returns 脱敏后的邮箱，如：u***@example.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const [username, domain] = email.split('@');
  if (!domain) return email;
  if (username.length <= 1) return `*@${domain}`;
  return `${username[0]}***@${domain}`;
}

/**
 * 根据用户角色决定是否脱敏敏感字段
 * @param userRole 用户角色
 * @returns 是否需要脱敏（true=需要脱敏，false=不脱敏）
 */
export function shouldMaskSensitiveData(userRole: string | undefined): boolean {
  // 管理员可以看到完整信息，其他角色需要脱敏
  return userRole !== 'admin';
}

/**
 * 脱敏用户对象中的敏感字段
 * @param user 用户对象
 * @param currentUserRole 当前登录用户的角色
 * @returns 脱敏后的用户对象
 */
export function maskUserSensitiveFields(
  user: any,
  currentUserRole: string | undefined
): any {
  if (!user) return user;
  if (!shouldMaskSensitiveData(currentUserRole)) {
    // 管理员可以看到完整信息
    return user;
  }

  const masked = { ...user };

  // 脱敏手机号
  if (masked.phone) {
    masked.phone = maskPhone(masked.phone);
  }

  // 脱敏身份证号
  if (masked.idCard) {
    masked.idCard = maskIdCard(masked.idCard);
  }

  // 脱敏邮箱
  if (masked.email) {
    masked.email = maskEmail(masked.email);
  }

  return masked;
}
