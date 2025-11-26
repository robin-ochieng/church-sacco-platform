import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AddGuarantorDto } from './dto/add-guarantor.dto';
import { ApproveGuarantorDto } from './dto/approve-guarantor.dto';
import { GuarantorsService } from './guarantors.service';

@Controller('loans/:loanId/guarantors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuarantorsController {
  constructor(private readonly guarantorsService: GuarantorsService) {}

  /**
   * Add a guarantor to a loan
   * POST /loans/:loanId/guarantors
   */
  @Post()
  @Roles('ADMIN', 'TREASURER', 'CLERK', 'MEMBER')
  addGuarantor(
    @Param('loanId') loanId: string,
    @Body() dto: AddGuarantorDto,
  ) {
    return this.guarantorsService.addGuarantor(loanId, dto);
  }

  /**
   * Get all guarantors for a loan
   * GET /loans/:loanId/guarantors
   */
  @Get()
  @Roles('ADMIN', 'TREASURER', 'CLERK', 'MEMBER')
  getGuarantors(@Param('loanId') loanId: string) {
    return this.guarantorsService.getGuarantorsForLoan(loanId);
  }

  /**
   * Get eligible guarantors for a loan
   * GET /loans/:loanId/guarantors/eligible
   */
  @Get('eligible')
  @Roles('ADMIN', 'TREASURER', 'CLERK', 'MEMBER')
  getEligibleGuarantors(
    @Param('loanId') loanId: string,
    @Query('search') searchQuery?: string,
  ) {
    return this.guarantorsService.getEligibleGuarantors(loanId, searchQuery);
  }

  /**
   * Approve or decline a guarantee request
   * PATCH /loans/:loanId/guarantors/:guarantorId/approve
   */
  @Patch(':guarantorId/approve')
  @Roles('ADMIN', 'TREASURER', 'CLERK', 'MEMBER')
  approveGuarantor(
    @Param('loanId') loanId: string,
    @Param('guarantorId') guarantorId: string,
    @Body() dto: ApproveGuarantorDto,
    // In a real implementation, you'd get the acting member ID from the JWT
  ) {
    return this.guarantorsService.approveGuarantor(loanId, guarantorId, dto);
  }

  /**
   * Remove a pending guarantor
   * DELETE /loans/:loanId/guarantors/:guarantorId
   */
  @Delete(':guarantorId')
  @Roles('ADMIN', 'TREASURER', 'CLERK', 'MEMBER')
  removeGuarantor(
    @Param('loanId') loanId: string,
    @Param('guarantorId') guarantorId: string,
  ) {
    return this.guarantorsService.removeGuarantor(loanId, guarantorId);
  }
}

/**
 * Separate controller for member guarantor exposure
 */
@Controller('members/:memberId/guarantor-exposure')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MemberGuarantorExposureController {
  constructor(private readonly guarantorsService: GuarantorsService) {}

  /**
   * Get guarantor exposure summary for a member
   * GET /members/:memberId/guarantor-exposure
   */
  @Get()
  @Roles('ADMIN', 'TREASURER', 'CLERK', 'MEMBER')
  getGuarantorExposure(@Param('memberId') memberId: string) {
    return this.guarantorsService.getGuarantorExposure(memberId);
  }
}
