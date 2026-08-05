import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DISCORD_API = 'https://discord.com/api/v10';
const TEXT_CHANNEL = 0;
const VOICE_CHANNEL = 2;
const CATEGORY_CHANNEL = 4;
const SEND_MESSAGES = 1n << 11n;
const DEFAULT_HISTORY_CATEGORY = 'Histórias da Fogueira';

interface DiscordPermissionOverwrite {
  id: string;
  type: number;
  allow: string;
  deny: string;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  topic?: string | null;
  position?: number;
  permission_overwrites?: DiscordPermissionOverwrite[];
}

interface DiscordScheduledEvent {
  id: string;
  name: string;
  channel_id: string | null;
  scheduled_start_time: string;
}

interface DiscordMessage {
  id: string;
  embeds?: Array<{ footer?: { text?: string } }>;
}

export interface DiscordGameCard {
  title: string;
  description: string;
  url: string | null;
  imageUrl: string | null;
  details: string | null;
  marker: string;
}

export interface DiscordCycleInput {
  enabled: boolean;
  oldChannelId?: string;
  discussionCategoryId?: string;
  historyCategoryId?: string;
  voiceChannelId?: string;
  newChannelName?: string;
  newChannelTopic?: string;
}

export interface DiscordCyclePreview {
  configured: boolean;
  enabled: boolean;
  guildId: string;
  channels: {
    text: DiscordChannel[];
    categories: DiscordChannel[];
    voice: DiscordChannel[];
  };
  plan: {
    oldChannel: DiscordChannel | null;
    discussionCategory: DiscordChannel | null;
    historyCategory: DiscordChannel | null;
    createHistoryCategory: boolean;
    newChannelName: string;
    newChannelTopic: string;
    existingNewChannel: DiscordChannel | null;
    voiceChannel: DiscordChannel | null;
    eventName: string | null;
    gameCard: DiscordGameCard;
  };
  warnings: string[];
  errors: string[];
}

export interface DiscordCycleResult {
  archivedChannelId: string | null;
  historyCategoryId: string | null;
  newChannelId: string | null;
  eventId: string | null;
  eventUrl: string | null;
  gameMessageId: string | null;
  gameMessageUrl: string | null;
}

@Injectable()
export class DiscordCycleService {
  private readonly botToken: string;
  private readonly guildId: string;

  constructor(config: ConfigService) {
    this.botToken = config.get<string>('DISCORD_BOT_TOKEN')?.trim() ?? '';
    this.guildId =
      config.get<string>('DISCORD_GUILD_ID')?.trim() ?? '1534325844619821170';
  }

  isConfigured(): boolean {
    return Boolean(this.botToken && this.guildId);
  }

  async preview(input: {
    currentGameTitle: string | null;
    nextGame: {
      title: string;
      summary?: string | null;
      steam?: string | null;
      trailer?: string | null;
      howLongToBeatUrl?: string | null;
      durationLabel?: string | null;
      cover?: string | null;
    };
    nextMonth: string;
    nextYear: string;
    meetingAt?: string;
    discord?: DiscordCycleInput;
  }): Promise<DiscordCyclePreview> {
    const enabled = input.discord?.enabled ?? true;
    const emptyChannels = { text: [], categories: [], voice: [] };
    const basePlan = {
      oldChannel: null,
      discussionCategory: null,
      historyCategory: null,
      createHistoryCategory: false,
      newChannelName: this.slugify(
        input.discord?.newChannelName ?? input.nextGame.title,
      ),
      newChannelTopic:
        input.discord?.newChannelTopic?.trim() ||
        `Conversa sobre ${input.nextGame.title}, jogo de ${input.nextMonth} de ${input.nextYear}.`,
      existingNewChannel: null,
      voiceChannel: null,
      eventName: input.meetingAt
        ? `Encontro de ${input.nextMonth}: ${input.nextGame.title}`.slice(
            0,
            100,
          )
        : null,
      gameCard: this.buildGameCard(input),
    };

    if (!enabled) {
      return {
        configured: this.isConfigured(),
        enabled,
        guildId: this.guildId,
        channels: emptyChannels,
        plan: basePlan,
        warnings: ['A transição do Discord foi desativada para esta campanha.'],
        errors: [],
      };
    }

    if (!this.isConfigured()) {
      return {
        configured: false,
        enabled,
        guildId: this.guildId,
        channels: emptyChannels,
        plan: basePlan,
        warnings: [],
        errors: [
          'DISCORD_BOT_TOKEN não está configurado no servidor. Desative o Discord explicitamente ou configure o bot.',
        ],
      };
    }

    const channels = await this.getChannels();
    const text = channels.filter((channel) => channel.type === TEXT_CHANNEL);
    const categories = channels.filter(
      (channel) => channel.type === CATEGORY_CHANNEL,
    );
    const voice = channels.filter((channel) => channel.type === VOICE_CHANNEL);
    const errors: string[] = [];
    const warnings: string[] = [];

    const oldChannel = this.resolveChannel(
      text,
      input.discord?.oldChannelId,
      input.currentGameTitle,
    );
    if (input.currentGameTitle && !oldChannel) {
      errors.push(
        `Não foi possível localizar o canal atual de ${input.currentGameTitle}. Selecione-o manualmente.`,
      );
    }

    const discussionCategory =
      this.resolveChannel(
        categories,
        input.discord?.discussionCategoryId,
        null,
      ) ??
      categories.find((category) => category.id === oldChannel?.parent_id) ??
      null;
    const historyCategory =
      this.resolveChannel(
        categories,
        input.discord?.historyCategoryId,
        DEFAULT_HISTORY_CATEGORY,
      ) ?? null;
    const voiceChannel = input.meetingAt
      ? (this.resolveChannel(
          voice,
          input.discord?.voiceChannelId,
          'Fogueira',
        ) ?? null)
      : null;

    if (input.meetingAt && !voiceChannel) {
      errors.push(
        'Selecione o canal de voz onde o próximo encontro será realizado.',
      );
    }

    const existingNewChannel =
      text.find(
        (channel) =>
          this.normalize(channel.name) ===
            this.normalize(basePlan.newChannelName) &&
          channel.id !== oldChannel?.id,
      ) ?? null;
    if (existingNewChannel) {
      warnings.push(
        `O canal #${existingNewChannel.name} já existe e será reutilizado.`,
      );
    }

    return {
      configured: true,
      enabled,
      guildId: this.guildId,
      channels: { text, categories, voice },
      plan: {
        ...basePlan,
        oldChannel,
        discussionCategory,
        historyCategory,
        createHistoryCategory: !historyCategory,
        existingNewChannel,
        voiceChannel,
      },
      warnings,
      errors,
    };
  }

  async apply(
    preview: DiscordCyclePreview,
    meetingAt: string | undefined,
    eventDescription: string,
  ): Promise<DiscordCycleResult> {
    if (!preview.enabled) {
      return {
        archivedChannelId: null,
        historyCategoryId: null,
        newChannelId: null,
        eventId: null,
        eventUrl: null,
        gameMessageId: null,
        gameMessageUrl: null,
      };
    }

    if (!preview.configured || preview.errors.length > 0) {
      throw new BadRequestException({
        message: 'A transição do Discord ainda não está pronta',
        errors: preview.errors,
      });
    }

    let historyCategory = preview.plan.historyCategory;
    if (!historyCategory) {
      historyCategory = await this.request<DiscordChannel>(
        `/guilds/${this.guildId}/channels`,
        {
          method: 'POST',
          body: { name: DEFAULT_HISTORY_CATEGORY, type: CATEGORY_CHANNEL },
          reason: 'Criar arquivo de discussões concluídas do Bonfire',
        },
      );
    }

    if (preview.plan.oldChannel) {
      await this.request<DiscordChannel>(
        `/channels/${preview.plan.oldChannel.id}`,
        {
          method: 'PATCH',
          body: { parent_id: historyCategory.id },
          reason: 'Arquivar discussão do jogo concluído',
        },
      );
      const everyoneOverwrite =
        preview.plan.oldChannel.permission_overwrites?.find(
          (overwrite) => overwrite.id === this.guildId && overwrite.type === 0,
        );
      const allow = BigInt(everyoneOverwrite?.allow ?? '0');
      const deny = BigInt(everyoneOverwrite?.deny ?? '0') | SEND_MESSAGES;
      await this.request<void>(
        `/channels/${preview.plan.oldChannel.id}/permissions/${this.guildId}`,
        {
          method: 'PUT',
          body: { type: 0, allow: allow.toString(), deny: deny.toString() },
          reason: 'Tornar a discussão arquivada somente leitura',
        },
      );
    }

    const newChannel =
      preview.plan.existingNewChannel ??
      (await this.request<DiscordChannel>(`/guilds/${this.guildId}/channels`, {
        method: 'POST',
        body: {
          name: preview.plan.newChannelName,
          type: TEXT_CHANNEL,
          parent_id: preview.plan.discussionCategory?.id ?? null,
          topic: preview.plan.newChannelTopic,
        },
        reason: 'Criar discussão do novo jogo do Bonfire',
      }));

    const gameMessage = await this.ensureGameCard(
      newChannel,
      preview.plan.gameCard,
      Boolean(preview.plan.existingNewChannel),
    );

    let event: DiscordScheduledEvent | null = null;
    if (meetingAt && preview.plan.voiceChannel && preview.plan.eventName) {
      const events = await this.request<DiscordScheduledEvent[]>(
        `/guilds/${this.guildId}/scheduled-events?with_user_count=false`,
      );
      event =
        events.find(
          (candidate) =>
            candidate.name === preview.plan.eventName &&
            new Date(candidate.scheduled_start_time).getTime() ===
              new Date(meetingAt).getTime(),
        ) ??
        (await this.request<DiscordScheduledEvent>(
          `/guilds/${this.guildId}/scheduled-events`,
          {
            method: 'POST',
            body: {
              channel_id: preview.plan.voiceChannel.id,
              entity_type: 2,
              privacy_level: 2,
              name: preview.plan.eventName,
              description: eventDescription.slice(0, 1000),
              scheduled_start_time: meetingAt,
            },
            reason: 'Agendar encontro do novo ciclo do Bonfire',
          },
        ));
    }

    return {
      archivedChannelId: preview.plan.oldChannel?.id ?? null,
      historyCategoryId: historyCategory.id,
      newChannelId: newChannel.id,
      eventId: event?.id ?? null,
      eventUrl: event
        ? `https://discord.com/events/${this.guildId}/${event.id}`
        : null,
      gameMessageId: gameMessage.id,
      gameMessageUrl: `https://discord.com/channels/${this.guildId}/${newChannel.id}/${gameMessage.id}`,
    };
  }

  private buildGameCard(input: {
    nextGame: {
      title: string;
      summary?: string | null;
      steam?: string | null;
      trailer?: string | null;
      howLongToBeatUrl?: string | null;
      durationLabel?: string | null;
      cover?: string | null;
    };
    nextMonth: string;
    nextYear: string;
  }): DiscordGameCard {
    const links = [
      input.nextGame.steam ? `[Steam](${input.nextGame.steam})` : null,
      input.nextGame.trailer ? `[Trailer](${input.nextGame.trailer})` : null,
      input.nextGame.howLongToBeatUrl
        ? `[HowLongToBeat](${input.nextGame.howLongToBeatUrl})`
        : null,
    ].filter(Boolean);
    return {
      title: input.nextGame.title,
      description:
        input.nextGame.summary?.trim() ||
        'Uma nova jornada escolhida ao redor da fogueira.',
      url: input.nextGame.steam ?? null,
      imageUrl: input.nextGame.cover ?? null,
      details: [input.nextGame.durationLabel, links.join(' · ')]
        .filter(Boolean)
        .join('\n'),
      marker: `Sob a Luz do Bonfire · ${input.nextMonth} ${input.nextYear}`,
    };
  }

  private async ensureGameCard(
    channel: DiscordChannel,
    card: DiscordGameCard,
    mayAlreadyExist: boolean,
  ): Promise<DiscordMessage> {
    if (mayAlreadyExist) {
      const messages = await this.request<DiscordMessage[]>(
        `/channels/${channel.id}/messages?limit=50`,
      );
      const existing = messages.find((message) =>
        message.embeds?.some((embed) => embed.footer?.text === card.marker),
      );
      if (existing) return existing;
    }

    return this.request<DiscordMessage>(`/channels/${channel.id}/messages`, {
      method: 'POST',
      body: {
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: card.title,
            description: card.description,
            url: card.url ?? undefined,
            color: 0xd87649,
            image: card.imageUrl ? { url: card.imageUrl } : undefined,
            fields: card.details
              ? [{ name: 'Para a jornada', value: card.details }]
              : undefined,
            footer: { text: card.marker },
          },
        ],
      },
      reason: 'Publicar informações do novo jogo do Bonfire',
    });
  }

  private async getChannels(): Promise<DiscordChannel[]> {
    return this.request<DiscordChannel[]>(`/guilds/${this.guildId}/channels`);
  }

  private resolveChannel(
    channels: DiscordChannel[],
    id: string | undefined,
    fallbackName: string | null,
  ): DiscordChannel | null {
    if (id) {
      return channels.find((channel) => channel.id === id) ?? null;
    }

    if (!fallbackName) return null;
    const target = this.normalize(this.slugify(fallbackName));
    return (
      channels.find(
        (channel) => this.normalize(this.slugify(channel.name)) === target,
      ) ?? null
    );
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  }

  private normalize(value: string): string {
    return value.trim().toLocaleLowerCase('pt-BR');
  }

  private async request<T>(
    path: string,
    options: {
      method?: 'POST' | 'PATCH' | 'PUT';
      body?: Record<string, unknown>;
      reason?: string;
    } = {},
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${DISCORD_API}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
          ...(options.reason
            ? { 'X-Audit-Log-Reason': encodeURIComponent(options.reason) }
            : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch {
      throw new ServiceUnavailableException(
        'Discord is temporarily unavailable',
      );
    }

    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      throw new BadGatewayException(
        `Discord rejected the operation (${response.status}): ${details}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}
