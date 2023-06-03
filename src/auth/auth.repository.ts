import { PrismaService } from "@/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { CreateAccountDto } from "./dto/create-account.dto";
import { AccountEntity } from "./entity/auth.entity";

@Injectable()
export class AuthRepository {
	constructor(private prisma: PrismaService) { }

	async create(data: CreateAccountDto) {
		return await this.prisma.account.create({ data });
	}

	async findByEmail(email: string): Promise<AccountEntity | null> {
		return await this.prisma.account.findFirst({ where: { email } });
	}

	async findById(id: number): Promise<AccountEntity | null> {
		return await this.prisma.account.findFirst({ where: { id } });
	}
}