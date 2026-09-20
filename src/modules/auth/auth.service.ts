import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { UsersRepository } from '../users/users.repository';
import { SessionsRepository } from './sessions.repository';
import { LoginDto } from './dto/login.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly jwt: JwtService,
  ) {}
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.users.findForLogin(dto.email.trim().toLowerCase());
    if (!user || !(await compare(dto.password, user.hashedPassword)))
      throw new UnauthorizedException('E-mail ou senha inválidos');
    const session = await this.sessions.createForLogin(user.id);
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, jti: session.id },
      { algorithm: 'HS256' },
    );
    return { user: UserResponseDto.fromEntity(user), accessToken };
  }
  async me(): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(await this.sessions.currentUser());
  }
  async logout() {
    await this.sessions.revokeCurrent();
    return { success: true };
  }
  async logoutAll() {
    await this.sessions.revokeAll();
    return { success: true };
  }
}
