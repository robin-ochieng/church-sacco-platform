import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Logger,
    Param,
    Patch,
    Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MpesaWebhookDto, MpesaWebhookResponseDto } from './dto/mpesa-webhook.dto';
import { MpesaService } from './mpesa.service';
// import { Public } from '../auth/decorators/public.decorator';

@ApiTags('M-Pesa')
@Controller('mpesa')
export class MpesaController {
  private readonly logger = new Logger(MpesaController.name);

  constructor(private readonly mpesaService: MpesaService) {}

  // @Public()
  @Post('c2b/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'M-Pesa C2B webhook endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    type: MpesaWebhookResponseDto,
  })
  async handleWebhook(
    @Body() payload: MpesaWebhookDto,
    @Headers('x-safaricom-signature') signature?: string,
  ): Promise<MpesaWebhookResponseDto> {
    this.logger.log(`Received M-Pesa webhook: ${payload.TransID}`);

    // Validate signature (stub for now)
    const isValid = this.mpesaService.validateSignature(payload, signature);
    if (!isValid) {
      this.logger.warn('Invalid signature received');
      return {
        ResultCode: 1,
        ResultDesc: 'Invalid signature',
      };
    }

    try {
      const result = await this.mpesaService.processWebhook(payload);

      this.logger.log(
        `Webhook processed: ${result.status} - ${result.mpesaMessageId}`,
      );

      return {
        ResultCode: 0,
        ResultDesc: 'Success',
      };
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${(error as Error).message}`);
      return {
        ResultCode: 1,
        ResultDesc: 'Processing failed',
      };
    }
  }

  @Get('suspense')
  @ApiOperation({ summary: 'Get all unmatched M-Pesa messages in suspense' })
  @ApiResponse({
    status: 200,
    description: 'List of suspense messages',
  })
  async getSuspenseMessages() {
    return this.mpesaService.getSuspenseMessages();
  }

  @Patch('suspense/:messageId/resolve')
  @ApiOperation({ summary: 'Manually resolve a suspense M-Pesa message' })
  @ApiResponse({
    status: 200,
    description: 'Transaction created and message resolved',
  })
  async resolveSuspenseMessage(
    @Param('messageId') messageId: string,
    @Body('memberId') memberId: string,
  ) {
    if (!memberId) {
      throw new BadRequestException('memberId is required');
    }

    return this.mpesaService.resolveSuspenseMessage(messageId, memberId);
  }
}
