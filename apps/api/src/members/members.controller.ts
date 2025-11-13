import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { MembersService } from './members.service';
import { CreateMemberDto, UpdateMemberDto, MemberQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
}
