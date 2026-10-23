import { DataSource, In } from 'typeorm';
import {
  AuditLog,
  Report,
  ReportEntityType,
  ReportStatus,
} from '@modules/admin/entities';
import {
  ForumCategory,
  ForumComment,
  ForumCommentStatus,
  ForumPost,
  ForumPostStatus,
} from '@modules/forum/entities';
import { Listing, ListingStatus } from '@modules/listings/entities';
import { User } from '@modules/users/entities';

const HOUR_MS = 60 * 60 * 1000;

interface DemoPost {
  authorPhone: string;
  category: ForumCategory;
  title: string;
  content: string;
  status: ForumPostStatus;
  viewCount: number;
  hoursAgo: number;
}

interface DemoComment {
  postTitle: string;
  authorPhone: string;
  content: string;
  hoursAgo: number;
}

interface DemoReport {
  reporterPhone: string;
  reason: string;
  note: string | null;
  hoursAgo: number;
}

interface DemoReportGroup {
  target: string;
  reports: DemoReport[];
  resolution?: {
    status: ReportStatus.RESOLVED | ReportStatus.DISMISSED;
    action: string;
    reason: string;
  };
}

const ADMIN_PHONE = '0900000299';

const REPORTER_PHONES = [
  '0900000001',
  '0900000211',
  '0900000212',
  '0900000213',
  '0900000206',
] as const;

const DEMO_POSTS: readonly DemoPost[] = [
  {
    authorPhone: '0900000213',
    category: ForumCategory.QUESTION,
    title: 'Ai cần thuê phòng gấp inbox mình, có cọc trước ưu tiên',
    content:
      'Mình có phòng ở Hoà Khánh Nam, giá rẻ hơn thị trường 300k. Bạn nào cần chuyển cọc trước 500k vào STK 0123 456 789 (Vietcombank) mình giữ phòng và gửi địa chỉ sau. Còn 2 suất, ai nhanh tay thì được.',
    status: ForumPostStatus.PUBLISHED,
    viewCount: 18,
    hoursAgo: 30,
  },
  {
    authorPhone: '0900000211',
    category: ForumCategory.ROOMMATE,
    title: 'Tìm bạn ở ghép khu Hoà Khánh',
    content:
      'Phòng 25m² gần ĐH Bách khoa, tìm thêm 1 bạn nữ ở ghép, chia đôi tiền phòng và điện nước. Ưu tiên bạn sạch sẽ, không hút thuốc.',
    status: ForumPostStatus.PUBLISHED,
    viewCount: 42,
    hoursAgo: 72,
  },
];

const DEMO_COMMENTS: readonly DemoComment[] = [
  {
    postTitle: DEMO_POSTS[0].title,
    authorPhone: '0900000001',
    content: 'Mình bị lừa kiểu này rồi, mọi người cẩn thận nhé.',
    hoursAgo: 26,
  },
  {
    postTitle: DEMO_POSTS[0].title,
    authorPhone: '0900000212',
    content: 'Báo cáo bài này, nghi lừa đảo.',
    hoursAgo: 24,
  },
  {
    postTitle: DEMO_POSTS[0].title,
    authorPhone: '0900000213',
    content: 'Phòng thật nhé, liên hệ qua inbox.',
    hoursAgo: 23,
  },
  {
    postTitle: DEMO_POSTS[1].title,
    authorPhone: '0900000213',
    content: 'Ở với bạn này thì xác định mất đồ, ai rảnh thì ở.',
    hoursAgo: 20,
  },
];

const reports = (reasons: [string, string | null, number][]): DemoReport[] =>
  reasons.map(([reason, note, hoursAgo], index) => ({
    reporterPhone: REPORTER_PHONES[index % REPORTER_PHONES.length],
    reason,
    note,
    hoursAgo,
  }));

async function upsertPosts(dataSource: DataSource, users: Map<string, User>) {
  const repository = dataSource.getRepository(ForumPost);
  const existing = await repository.find({
    where: { title: In(DEMO_POSTS.map((post) => post.title)) },
  });
  const byTitle = new Map(existing.map((post) => [post.title, post]));
  const missing = DEMO_POSTS.filter((post) => !byTitle.has(post.title));

  if (missing.length) {
    const saved = await repository.save(
      missing.map((post) => {
        const createdAt = new Date(Date.now() - post.hoursAgo * HOUR_MS);

        return repository.create({
          authorId: requireUser(users, post.authorPhone).id,
          category: post.category,
          title: post.title,
          content: post.content,
          imageKeys: [],
          status: post.status,
          viewCount: post.viewCount,
          publishedAt: createdAt,
          createdAt,
          updatedAt: createdAt,
        });
      }),
    );

    saved.forEach((post) => byTitle.set(post.title, post));
  }

  return byTitle;
}

async function upsertComments(
  dataSource: DataSource,
  users: Map<string, User>,
  posts: Map<string, ForumPost>,
) {
  const repository = dataSource.getRepository(ForumComment);
  const postIds = [...posts.values()].map((post) => post.id);
  const existing = await repository.find({ where: { postId: In(postIds) } });
  const key = (postId: string, content: string) => `${postId}:${content}`;
  const byKey = new Map(
    existing.map((comment) => [key(comment.postId, comment.content), comment]),
  );
  const drafts = DEMO_COMMENTS.map((comment) => ({
    comment,
    postId: requirePost(posts, comment.postTitle).id,
  })).filter(({ comment, postId }) => !byKey.has(key(postId, comment.content)));

  if (drafts.length) {
    const saved = await repository.save(
      drafts.map(({ comment, postId }) => {
        const createdAt = new Date(Date.now() - comment.hoursAgo * HOUR_MS);

        return repository.create({
          postId,
          authorId: requireUser(users, comment.authorPhone).id,
          parentId: null,
          content: comment.content,
          status: ForumCommentStatus.PUBLISHED,
          createdAt,
          updatedAt: createdAt,
        });
      }),
    );

    saved.forEach((comment) =>
      byKey.set(key(comment.postId, comment.content), comment),
    );

    for (const post of posts.values()) {
      const commentCount = await repository.count({
        where: { postId: post.id, status: ForumCommentStatus.PUBLISHED },
      });

      await dataSource
        .getRepository(ForumPost)
        .update(post.id, { commentCount });
    }
  }

  return (postTitle: string, content: string) => {
    const comment = byKey.get(key(requirePost(posts, postTitle).id, content));

    if (!comment) throw new Error(`Missing demo comment: ${content}`);

    return comment;
  };
}

async function pickListings(dataSource: DataSource) {
  const repository = dataSource.getRepository(Listing);
  const [active, pending] = await Promise.all([
    repository.find({
      where: { status: ListingStatus.ACTIVE },
      order: { createdAt: 'DESC', id: 'ASC' },
      take: 4,
    }),
    repository.find({
      where: { status: ListingStatus.PENDING },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: 1,
    }),
  ]);

  return { active, pending };
}

export async function seedModeration(
  dataSource: DataSource,
  users: Map<string, User>,
): Promise<void> {
  const posts = await upsertPosts(dataSource, users);
  const findComment = await upsertComments(dataSource, users, posts);
  const { active, pending } = await pickListings(dataSource);

  if (active.length < 4) return;

  const groups: {
    entityType: ReportEntityType;
    entityId: string;
    group: DemoReportGroup;
  }[] = [
    {
      entityType: ReportEntityType.LISTING,
      entityId: active[0].id,
      group: {
        target: active[0].title,
        reports: reports([
          [
            'scam',
            'Mình nhắn hỏi thì bạn này bảo chuyển 500k giữ chỗ rồi mới cho xem phòng, không cho xem trước.',
            3,
          ],
          ['scam', 'Đòi cọc trước khi xem phòng.', 6],
          ['scam', null, 9],
          ['false_information', 'Ảnh không giống phòng thực tế.', 14],
        ]),
      },
    },
    {
      entityType: ReportEntityType.FORUM_POST,
      entityId: requirePost(posts, DEMO_POSTS[0].title).id,
      group: {
        target: DEMO_POSTS[0].title,
        reports: reports([
          ['spam', 'Đăng cùng nội dung ở nhiều chuyên mục.', 5],
          [
            'contact_information',
            'Đăng số tài khoản ngân hàng, yêu cầu chuyển cọc.',
            26,
          ],
        ]),
      },
    },
    {
      entityType: ReportEntityType.LISTING,
      entityId: active[1].id,
      group: {
        target: active[1].title,
        reports: reports([
          ['wrong_price', 'Giá thực tế cao hơn 500k so với tin đăng.', 11],
        ]),
      },
    },
    {
      entityType: ReportEntityType.USER,
      entityId: requireUser(users, '0900000202').id,
      group: {
        target: 'Trần Thị Mai',
        reports: reports([
          ['scam', 'Lừa đảo nhiều lần, nhận cọc rồi không trả.', 8],
          ['scam', null, 20],
          ['harassment', 'Nhắn tin đe doạ sau khi mình huỷ lịch.', 33],
        ]),
      },
    },
    {
      entityType: ReportEntityType.FORUM_COMMENT,
      entityId: findComment(DEMO_POSTS[1].title, DEMO_COMMENTS[3].content).id,
      group: {
        target: DEMO_COMMENTS[3].content,
        reports: reports([
          ['harassment', 'Bình luận xúc phạm người đăng.', 12],
        ]),
      },
    },
    ...(pending[0]
      ? [
          {
            entityType: ReportEntityType.LISTING,
            entityId: pending[0].id,
            group: {
              target: pending[0].title,
              reports: reports([
                ['false_information', 'Địa chỉ trên bản đồ không đúng.', 2],
              ]),
            },
          },
        ]
      : []),
    {
      entityType: ReportEntityType.LISTING,
      entityId: active[2].id,
      group: {
        target: active[2].title,
        reports: reports([['already_rented', 'Phòng đã có người thuê.', 40]]),
        resolution: {
          status: ReportStatus.RESOLVED,
          action: 'report.warn',
          reason: 'Đã nhắc chủ trọ cập nhật trạng thái phòng đã cho thuê.',
        },
      },
    },
    {
      entityType: ReportEntityType.FORUM_POST,
      entityId: requirePost(posts, DEMO_POSTS[1].title).id,
      group: {
        target: DEMO_POSTS[1].title,
        reports: reports([['other', 'Nội dung không phù hợp.', 50]]),
        resolution: {
          status: ReportStatus.DISMISSED,
          action: 'report.dismiss',
          reason: 'Nội dung bài viết không vi phạm quy định.',
        },
      },
    },
    {
      entityType: ReportEntityType.LISTING,
      entityId: active[3].id,
      group: {
        target: active[3].title,
        reports: reports([
          ['wrong_price', null, 60],
          ['other', 'Chủ trọ không nghe máy.', 64],
        ]),
        resolution: {
          status: ReportStatus.DISMISSED,
          action: 'report.dismiss',
          reason: 'Giá đã được chủ trọ cập nhật đúng.',
        },
      },
    },
  ];
  const admin = requireUser(users, ADMIN_PHONE);
  const repository = dataSource.getRepository(Report);
  const existing = await repository.find({
    where: { entityId: In(groups.map(({ entityId }) => entityId)) },
  });
  const seeded = new Set(existing.map((report) => report.entityId));
  let created = 0;

  for (const { entityType, entityId, group } of groups) {
    if (seeded.has(entityId)) continue;

    const resolvedAt = group.resolution
      ? new Date(Date.now() - (group.reports[0].hoursAgo - 1) * HOUR_MS)
      : null;

    await dataSource.transaction(async (manager) => {
      await manager.save(
        Report,
        group.reports.map((report) => {
          const createdAt = new Date(Date.now() - report.hoursAgo * HOUR_MS);

          return manager.create(Report, {
            reporterId: requireUser(users, report.reporterPhone).id,
            entityType,
            entityId,
            reason: report.reason,
            note: report.note,
            status: group.resolution?.status ?? ReportStatus.PENDING,
            resolvedBy: group.resolution ? admin.id : null,
            resolutionReason: group.resolution?.reason ?? null,
            resolvedAt,
            createdAt,
            updatedAt: createdAt,
          });
        }),
      );

      if (group.resolution && resolvedAt) {
        await manager.save(
          AuditLog,
          manager.create(AuditLog, {
            actorId: admin.id,
            action: group.resolution.action,
            entityType,
            entityId,
            reason: group.resolution.reason,
            createdAt: resolvedAt,
          }),
        );
      }
    });

    created += group.reports.length;
  }

  console.log(`[Demo] ${created} new moderation reports`);
}

function requireUser(users: Map<string, User>, phone: string): User {
  const user = users.get(phone);

  if (!user) throw new Error(`Missing demo account: ${phone}`);

  return user;
}

function requirePost(posts: Map<string, ForumPost>, title: string): ForumPost {
  const post = posts.get(title);

  if (!post) throw new Error(`Missing demo forum post: ${title}`);

  return post;
}
