import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMemberDto, MemberQueryDto, StatementQueryDto, StatementResponseDto, UpdateMemberDto } from './dto';
import { MembersService } from './members.service';

@ApiTags('Members')
@ApiBearerAuth('JWT-auth')
@Controller('members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new member' })
  @ApiBody({ type: CreateMemberDto })
  @ApiResponse({ status: 201, description: 'Member successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Member number already exists' })
  async create(@Body() createMemberDto: CreateMemberDto) {
    return this.membersService.create(createMemberDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all members with optional filters' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by member status' })
  @ApiResponse({ status: 200, description: 'Returns list of members' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Query() query: MemberQueryDto) {
    return this.membersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get member by ID' })
  @ApiParam({ name: 'id', description: 'Member UUID' })
  @ApiResponse({ status: 200, description: 'Returns member details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async findOne(@Param('id') id: string) {
    return this.membersService.findOne(id);
  }

  @Get('number/:memberNumber')
  @ApiOperation({ summary: 'Get member by member number' })
  @ApiParam({ name: 'memberNumber', description: 'Unique member number' })
  @ApiResponse({ status: 200, description: 'Returns member details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async findByMemberNumber(@Param('memberNumber') memberNumber: string) {
    return this.membersService.findByMemberNumber(memberNumber);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update member details' })
  @ApiParam({ name: 'id', description: 'Member UUID' })
  @ApiBody({ type: UpdateMemberDto })
  @ApiResponse({ status: 200, description: 'Member successfully updated' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async update(@Param('id') id: string, @Body() updateMemberDto: UpdateMemberDto) {
    return this.membersService.update(id, updateMemberDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a member' })
  @ApiParam({ name: 'id', description: 'Member UUID' })
  @ApiResponse({ status: 204, description: 'Member successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async remove(@Param('id') id: string) {
    return this.membersService.remove(id);
  }

  @Get(':id/savings')
  @ApiOperation({ summary: 'Get member savings accounts' })
  @ApiParam({ name: 'id', description: 'Member UUID' })
  @ApiResponse({ status: 200, description: 'Returns member savings accounts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async getMemberSavings(@Param('id') id: string) {
    return this.membersService.getMemberSavings(id);
  }

  @Get(':id/loans')
  @ApiOperation({ summary: 'Get member loans' })
  @ApiParam({ name: 'id', description: 'Member UUID' })
  @ApiResponse({ status: 200, description: 'Returns member loans' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async getMemberLoans(@Param('id') id: string) {
    return this.membersService.getMemberLoans(id);
  }

  @Get(':id/shares')
  @ApiOperation({ summary: 'Get member shares' })
  @ApiParam({ name: 'id', description: 'Member UUID' })
  @ApiResponse({ status: 200, description: 'Returns member shares' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async getMemberShares(@Param('id') id: string) {
    return this.membersService.getMemberShares(id);
  }

  @Get(':id/statement')
  @ApiOperation({ summary: 'Get member savings ledger and statement' })
  @ApiParam({ name: 'id', description: 'Member UUID' })
  @ApiQuery({ name: 's', required: false, description: 'Start date (YYYY-MM-DD)', example: '2024-01-01' })
  @ApiQuery({ name: 'e', required: false, description: 'End date (YYYY-MM-DD)', example: '2024-12-31' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by transaction type', enum: ['SAVINGS_DEPOSIT', 'SHARES_DEPOSIT', 'SPECIAL_CONTRIBUTION', 'MAINTENANCE_FEE', 'WITHDRAWAL', 'ADJUSTMENT'] })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns member statement with running balance',
    type: StatementResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async getStatement(
    @Param('id') id: string,
    @Query() query: StatementQueryDto,
  ) {
    return this.membersService.getStatement(id, query);
  }
}
