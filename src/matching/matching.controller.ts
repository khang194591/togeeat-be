import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Request, UnauthorizedException, UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { CreateMatchingDto } from './dto/create-matching.dto';
import { MatchingService } from './matching.service';
// import { UpdateMatchingDto } from './dto/update-matching.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { SearchQueryDto, SearchQueryPipe } from '@/common/pipes/search-query.pipe';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MatchingPaginationDto } from './dto/pagination.dto';
import { MatchingEntity, MatchingStatus } from './entities/matching.entity';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';


@Controller('matching')
@ApiTags('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new matching record' })
  @ApiCreatedResponse({ type: MatchingEntity })
  async create(@Request() req, @Body() createMatchingDto: CreateMatchingDto): Promise<MatchingEntity> {
    const currentUserId: number = req.user.id;
    const {matchingDate, duration, matchingType} = createMatchingDto;
    if(
      (matchingType == 'QUICK' && !duration) || 
      (matchingType == 'YOTEI' && !matchingDate)
    ) {
      throw new BadRequestException({message: 'Missing duration or matching date'});
    }
    if (duration && duration < 0) {
      throw new BadRequestException({ message: 'Invalid duration' });
    }
    if (matchingDate && matchingDate.valueOf() < (new Date()).valueOf()) {
      throw new BadRequestException({ message: 'Invalid matching date' });
    }
    return this.matchingService.create(currentUserId, createMatchingDto);
  }

  @Get()
  @ApiQuery({ name: 'ownerName', type: 'string', required: false, description: 'search for matchings whose owners whose name conatains this case-insensitive string'})
  @ApiQuery({ name: 'matchBefore', type: 'string', required: false, description: 'standard Date.toISOString() string'})
  @ApiQuery({ name: 'matchAfter', type: 'string', required: false, description: 'standard Date.toISOString() string'})
  @ApiQuery({ name: 'createdBefore', type: 'string', required: false, description: 'standard Date.toISOString() string'})
  @ApiQuery({ name: 'createdAfter', type: 'string', required: false, description: 'standard Date.toISOString() string'})
  @ApiQuery({name: 'status', enum: MatchingStatus, required: false, description: 'status of matching, if not provided all satisfied matchings is retrieved'})
  @ApiOperation({ summary: 'List all matching records, response is paginated. Filter matchings' })
  @ApiOkResponse({ type: [MatchingPaginationDto] })
  @UsePipes(SearchQueryPipe)
  async list(@Query() query: SearchQueryDto): Promise<PaginationDto> {
    // console.log(query);
    return await this.matchingService.list(query);
  }

  @Get('my-matchings')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new SearchQueryPipe())
  @ApiOperation({ summary: 'Get all matching created by current user. Filter matchings' })
  @ApiOkResponse({ type: [MatchingPaginationDto] })
  async getMyMatchings(@Request() req, @Query() query: SearchQueryDto): Promise<PaginationDto> {
    const currentUserId: number = req.user.id;
    return await this.matchingService.getMatchingsOfUser(currentUserId, query);
  }

  @Get('members')
  @UseGuards(JwtAuthGuard)
  @ApiQuery({ name: 'memberName', type: 'string', required: false, description: 'search for matching members name conatains this case-insensitive string'})
  async searchMatchingMembersByName(@Request() req, @Query('memberName') memberName: string) {
    const currentUserId: number = req.user.id;
    if(!memberName) {
      throw new BadRequestException({message: 'Missing member name'})
    }
    return this.matchingService.searchMatchingMembersByName(currentUserId, memberName);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a matching by id' })
  @ApiOkResponse({ type: MatchingEntity })
  async findOne(@Param('id') id: string): Promise<MatchingEntity> {
    const matching = await this.matchingService.findOne(+id);
    if (!matching) {
      throw new NotFoundException(`matching with id=${id} not found`);
    }
    return matching!;
  }

  // @Patch(':id')
  // @ApiOkResponse()
  // async update(@Param('id') id: string, @Body() updateMatchingDto: UpdateMatchingDto) {
  //   return await this.matchingService.update(+id, updateMatchingDto);
  // }

  @Patch('join/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Join current user to matching with id' })
  @ApiOkResponse()
  async joinMatching(@Request() req, @Param('id') id: string) {
    return await this.matchingService.joinUser(+id, req.user.id);
  }

  @Patch('/leave/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Current user leave matching with id, matching owner can remove other members from the matching' })
  @ApiOkResponse()
  async leaveMatching(@Request() req, @Param('id') id: string, @Query('userId') userId: string) {
    const currentUserId: number = req.user.id;
    const matching = await this.matchingService.findOne(+id);
    if (!matching) {
      throw new NotFoundException();
    }
    // matching owner removes member from matching
    if (currentUserId === matching.ownerId) {
      const uid = +userId;
      if (!uid) {
        throw new BadRequestException('missing member id');
      }
      this.matchingService.removeUser(+id, uid);
      return;
    }
    // a member leaves
    this.matchingService.removeUser(+id, currentUserId);

    throw new ForbiddenException('not allowed operation');
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a matching' })
  @ApiOkResponse()
  async remove(@Request() req, @Param('id') id: string): Promise<void> {
    const currentUserId: number = req.user.id;
    const matching = await this.matchingService.findOne(+id);
    if (!matching) {
      throw new NotFoundException();
    }
    if (matching.ownerId !== currentUserId) {
      throw new ForbiddenException('not allowed operation');
    }
    return await this.matchingService.remove(+id);
  }
}
