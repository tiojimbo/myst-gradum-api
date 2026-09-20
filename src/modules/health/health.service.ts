import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
export interface HealthStatus {
  status: 'ok';
}
@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}
  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.checkConnection();
    } catch {
      throw new ServiceUnavailableException('Serviço indisponível');
    }
    return { status: 'ok' };
  }
}
