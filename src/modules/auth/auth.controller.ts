import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { EmptyDto } from '../../common/dto/empty.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}
  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ long: { limit: 5, ttl: 60000 } })
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() dto: LoginDto, @Query() _query: EmptyDto) {
    void _query;
    return this.service.login(dto);
  }
  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponseDto })
  me(@Query() _query: EmptyDto, @Body() _body: EmptyDto) {
    void _query;
    void _body;
    return this.service.me();
  }
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  logout(@Body() _body: EmptyDto, @Query() _query: EmptyDto) {
    void _query;
    void _body;
    return this.service.logout();
  }
  @Post('logout-all')
  @HttpCode(200)
  @ApiBearerAuth()
  logoutAll(@Body() _body: EmptyDto, @Query() _query: EmptyDto) {
    void _query;
    void _body;
    return this.service.logoutAll();
  }
}
