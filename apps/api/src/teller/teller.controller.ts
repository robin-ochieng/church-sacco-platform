import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GetTellerSummaryQueryDto } from './dto/get-teller-summary.dto';
import { TellerSummaryResponseDto } from './dto/teller-summary-response.dto';
import { TellerService } from './teller.service';

@ApiTags('Teller')
@ApiBearerAuth('JWT-auth')
@Controller('teller')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLERK, UserRole.MANAGER, UserRole.TREASURER, UserRole.ADMIN, UserRole.SECRETARY)
export class TellerController {
  constructor(private readonly tellerService: TellerService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get daily teller summary with recent receipts' })
  @ApiOkResponse({ description: 'Aggregated teller activity for the selected date' })
  async getSummary(@Query() query: GetTellerSummaryQueryDto): Promise<TellerSummaryResponseDto> {
    return this.tellerService.getSummary(query);
  }
}
