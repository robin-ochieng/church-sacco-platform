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
import { MembersService } from './members.service';
import { CreateMemberDto, UpdateMemberDto, MemberQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createMemberDto: CreateMemberDto) {
    return this.membersService.create(createMemberDto);
  }

  @Get()
  async findAll(@Query() query: MemberQueryDto) {
    return this.membersService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.membersService.findOne(id);
  }

  @Get('number/:memberNumber')
  async findByMemberNumber(@Param('memberNumber') memberNumber: string) {
    return this.membersService.findByMemberNumber(memberNumber);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateMemberDto: UpdateMemberDto) {
    return this.membersService.update(id, updateMemberDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.membersService.remove(id);
  }

  @Get(':id/savings')
  async getMemberSavings(@Param('id') id: string) {
    return this.membersService.getMemberSavings(id);
  }

  @Get(':id/loans')
  async getMemberLoans(@Param('id') id: string) {
    return this.membersService.getMemberLoans(id);
  }

  @Get(':id/shares')
  async getMemberShares(@Param('id') id: string) {
    return this.membersService.getMemberShares(id);
  }
}
