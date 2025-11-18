import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import chromium from '@sparticuz/chromium';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import puppeteer, { Viewport } from 'puppeteer-core';
import QRCode from 'qrcode';
import { AuthenticatedUser } from '../auth/types';
import { StatementQueryDto, StatementResponseDto } from '../members/dto';
import { MembersService } from '../members/members.service';
import { PrismaService } from '../prisma/prisma.service';

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: {
    member: {
      select: {
        id: true;
        memberNumber: true;
        firstName: true;
        lastName: true;
        email: true;
      };
    };
    cashier: {
      select: {
        id: true;
        email: true;
      };
    };
  };
}>;

interface PdfPayload {
  filename: string;
  buffer: Buffer;
}

@Injectable()
export class ReceiptsService {
  private readonly appName = 'ACK Thiboro SACCO';
  private readonly currencyFormatter = new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  });
  private readonly dateFormatter = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  private readonly templateCache = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly membersService: MembersService,
  ) {}

  async generateTransactionReceiptPdf(receiptNumber: string): Promise<PdfPayload> {
    const transaction = await this.findTransactionByReceipt(receiptNumber);
    if (!transaction) {
      throw new NotFoundException('Receipt not found');
    }

    const verificationUrl = this.buildVerificationUrl(transaction.receiptNumber!);
    const qrCode = await this.generateQrCode(verificationUrl);

    const html = await this.renderTransactionTemplate(transaction, qrCode, verificationUrl);
    const buffer = await this.renderPdf(html);

    return {
      filename: `${transaction.receiptNumber}.pdf`,
      buffer,
    };
  }

  async generateStatementPdf(memberId: string, query: StatementQueryDto): Promise<PdfPayload> {
    const statement = await this.membersService.getStatement(memberId, query);
    const qrCode = await this.generateQrCode(this.buildMemberPortalUrl(statement.member.memberNumber));
    const html = await this.renderStatementTemplate(statement, qrCode);
    const buffer = await this.renderPdf(html);

    return {
      filename: `${statement.member.memberNumber}-statement.pdf`,
      buffer,
    };
  }

  async verifyReceipt(receiptNumber: string) {
    const transaction = await this.findTransactionByReceipt(receiptNumber);
    if (!transaction) {
      throw new NotFoundException('Receipt not found');
    }

    return {
      receiptNumber: transaction.receiptNumber,
      memberName: `${transaction.member.firstName} ${transaction.member.lastName}`.trim(),
      memberNumber: transaction.member.memberNumber,
      amount: Number(transaction.amount),
      type: transaction.type,
      channel: transaction.channel,
      status: transaction.status,
      tellerEmail: transaction.cashier?.email ?? null,
      valueDate: transaction.valueDate.toISOString(),
      narration: transaction.narration,
      verificationUrl: this.buildVerificationUrl(transaction.receiptNumber!),
      verifiedAt: new Date().toISOString(),
    };
  }

  async assertStatementAccess(memberId: string, user: AuthenticatedUser) {
    if (!user) {
      throw new ForbiddenException('Missing authentication context');
    }

    if (user.role === UserRole.MEMBER) {
      const member = await this.prisma.member.findUnique({
        where: { userId: user.sub },
        select: { id: true },
      });

      if (!member || member.id !== memberId) {
        throw new ForbiddenException('Members may only download their own statements');
      }
    }
  }

  private async findTransactionByReceipt(receiptNumber?: string | null): Promise<TransactionWithRelations | null> {
    if (!receiptNumber) {
      return null;
    }

    return this.prisma.transaction.findFirst({
      where: { receiptNumber },
      include: {
        member: {
          select: {
            id: true,
            memberNumber: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        cashier: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  private async renderTransactionTemplate(
    transaction: TransactionWithRelations,
    qrCode: string,
    verificationUrl: string,
  ) {
    const template = await this.loadTemplate('transaction');
    const replacements: Record<string, string> = {
      appName: this.appName,
      receiptNumber: transaction.receiptNumber ?? 'N/A',
      memberName: `${transaction.member.firstName} ${transaction.member.lastName}`.trim(),
      memberNumber: transaction.member.memberNumber,
      memberEmail: transaction.member.email,
      tellerEmail: transaction.cashier?.email ?? 'System Generated',
      transactionType: this.formatEnum(transaction.type),
      channel: this.formatEnum(transaction.channel),
      reference: transaction.reference ?? '—',
      narration: transaction.narration ?? 'Deposit',
      amount: this.formatCurrency(transaction.amount),
      valueDate: this.formatDate(transaction.valueDate),
      postedAt: this.formatDate(transaction.createdAt),
      balanceAfter: this.formatCurrency(transaction.balanceAfter ?? 0),
      verificationUrl,
      qrCode,
      branchId: transaction.branchId ?? '—',
    };

    return this.interpolate(template, replacements);
  }

  private async renderStatementTemplate(statement: StatementResponseDto, qrCode: string) {
    const template = await this.loadTemplate('statement');
    const transactionsRows = statement.transactions.length
      ? statement.transactions
          .map((entry) => {
            const date = this.formatDate(new Date(entry.date));
            return `
              <tr>
                <td>${date}</td>
                <td>${this.formatEnum(entry.type)}</td>
                <td>${entry.reference ?? '—'}</td>
                <td>${entry.narration ?? '—'}</td>
                <td class="amount debit">${entry.debit ? this.formatCurrency(entry.debit) : '—'}</td>
                <td class="amount credit">${entry.credit ? this.formatCurrency(entry.credit) : '—'}</td>
                <td class="amount">${this.formatCurrency(entry.balance)}</td>
              </tr>`;
          })
          .join('')
      : '<tr><td colspan="7" class="empty">No transactions for the selected period.</td></tr>';

    const replacements: Record<string, string> = {
      appName: this.appName,
      memberName: `${statement.member.firstName} ${statement.member.lastName}`.trim(),
      memberNumber: statement.member.memberNumber,
      memberEmail: statement.member.email,
      period: `${this.formatDate(new Date(statement.period.startDate))} - ${this.formatDate(
        new Date(statement.period.endDate),
      )}`,
      generatedAt: this.formatDate(new Date(statement.generatedAt)),
      openingBalance: this.formatCurrency(statement.openingBalance),
      closingBalance: this.formatCurrency(statement.closingBalance),
      totalDeposits: this.formatCurrency(statement.totalDeposits),
      totalWithdrawals: this.formatCurrency(statement.totalWithdrawals),
      transactionsRows,
      transactionCount: statement.transactionCount.toString(),
      qrCode,
      portalUrl: this.buildMemberPortalUrl(statement.member.memberNumber),
    };

    return this.interpolate(template, replacements);
  }

  private interpolate(template: string, replacements: Record<string, string>) {
    return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => replacements[key] ?? '');
  }

  private async loadTemplate(name: string) {
    if (this.templateCache.has(name)) {
      return this.templateCache.get(name)!;
    }

    const templatePath = join(__dirname, 'templates', `${name}.html`);
    const content = await readFile(templatePath, 'utf8');
    this.templateCache.set(name, content);
    return content;
  }

  private formatCurrency(value: Prisma.Decimal | number) {
    const numeric = typeof value === 'number' ? value : Number(value);
    return this.currencyFormatter.format(numeric);
  }

  private formatDate(value: Date) {
    return this.dateFormatter.format(value);
  }

  private formatEnum(value: string) {
    return value
      .toLowerCase()
      .split('_')
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
  }

  private buildVerificationUrl(receiptNumber: string) {
    const origin = this.getFrontendOrigin();
    return `${origin.replace(/\/$/, '')}/verify/receipt/${receiptNumber}`;
  }

  private buildMemberPortalUrl(memberNumber: string) {
    const origin = this.getFrontendOrigin();
    return `${origin.replace(/\/$/, '')}/members/${memberNumber}`;
  }

  private getFrontendOrigin() {
    return (
      this.configService.get<string>('WEB_ORIGIN') ||
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000'
    );
  }

  private async generateQrCode(value: string) {
    return QRCode.toDataURL(value, {
      margin: 1,
      width: 256,
      errorCorrectionLevel: 'M',
    });
  }

  private async renderPdf(html: string): Promise<Buffer> {
    if (this.isStubRenderer()) {
      return Buffer.from(html, 'utf8');
    }

    const executablePath = await this.resolveExecutablePath();
    const defaultViewport = (chromium as unknown as { defaultViewport?: Viewport }).defaultViewport ?? null;
    const headlessMode: boolean | 'shell' = (chromium as unknown as { headless?: boolean | 'shell' }).headless ?? true;

    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
    try {
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport,
        executablePath,
        headless: headlessMode,
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm',
        },
      });
      return Buffer.from(pdf);
    } catch (error) {
      throw new InternalServerErrorException('Unable to generate receipt PDF');
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async resolveExecutablePath() {
    const configuredPath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      process.env.CHROME_PATH ||
      process.env.CHROMIUM_PATH;
    if (configuredPath && existsSync(configuredPath)) {
      return configuredPath;
    }

    const chromiumPath = await chromium.executablePath();
    if (chromiumPath && existsSync(chromiumPath)) {
      return chromiumPath;
    }

    const platformFallbacks: Record<string, string | undefined> = {
      win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    };

    const fallback = platformFallbacks[process.platform];
    if (fallback && existsSync(fallback)) {
      return fallback;
    }

    throw new InternalServerErrorException(
      'Chrome executable path could not be resolved. Set PUPPETEER_EXECUTABLE_PATH in the environment.',
    );
  }

  private isStubRenderer() {
    return (process.env.RECEIPTS_RENDERER_MODE ?? '').toLowerCase() === 'stub';
  }
}
