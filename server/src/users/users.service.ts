import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

export type PublicUser = Omit<User, 'password'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<PublicUser> {
    const password: string = await bcrypt.hash(createUserDto.password, 12);

    const entity: User = this.userRepository.create({
      ...createUserDto,
      password,
    });

    return this.toPublicUser(await this.userRepository.save(entity));
  }

  async findAll(): Promise<PublicUser[]> {
    const users = await this.userRepository.find();
    return users.map((user) => this.toPublicUser(user));
  }

  async findOne(id: number): Promise<PublicUser> {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }

    return this.toPublicUser(user);
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<PublicUser> {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }

    if (updateUserDto.password) {
      const password: string = await bcrypt.hash(updateUserDto.password, 12);
      Object.assign(user, { ...updateUserDto, password });
    } else {
      Object.assign(user, updateUserDto);
    }

    return this.toPublicUser(await this.userRepository.save(user));
  }

  private toPublicUser(user: User): PublicUser {
    const { password, ...publicUser } = user;
    void password;
    return publicUser;
  }
}
