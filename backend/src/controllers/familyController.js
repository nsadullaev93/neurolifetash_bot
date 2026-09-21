const bot = require('../core/bot');
const FamilyMemberModel = require('../models/FamilyMember');
const InviteModel = require('../models/Invite');

function serializeMember(m) {
  return {
    id: m.id,
    role: m.role,
    displayName: m.displayName,
    canSeeMoney: m.canSeeMoney,
    sessionPings: m.sessionPings,
    paymentPings: m.paymentPings,
    theme: m.theme,
    joinedAt: m.joinedAt,
    user: m.user
      ? { firstName: m.user.firstName, lastName: m.user.lastName, username: m.user.username }
      : undefined,
  };
}

async function listMembers(req, res, next) {
  try {
    const members = await FamilyMemberModel.listAll();
    res.json(members.map(serializeMember));
  } catch (err) {
    next(err);
  }
}

async function createInvite(req, res, next) {
  try {
    const invite = await InviteModel.create(req.user.id);
    const username = bot.botInfo?.username;
    if (!username) {
      return res.status(503).json({ error: 'Бот ещё не готов, попробуйте через несколько секунд' });
    }
    const link = `https://t.me/${username}?start=inv_${invite.code}`;
    res.status(201).json({ link, expiresAt: invite.expiresAt });
  } catch (err) {
    next(err);
  }
}

async function updateMember(req, res, next) {
  try {
    const { canSeeMoney } = req.body;
    if (canSeeMoney === undefined) {
      return res.status(400).json({ error: 'Укажите canSeeMoney' });
    }
    const updated = await FamilyMemberModel.setCanSeeMoney(req.params.id, canSeeMoney);
    res.json(serializeMember(updated));
  } catch (err) {
    next(err);
  }
}

async function removeMember(req, res, next) {
  try {
    await FamilyMemberModel.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listMembers, createInvite, updateMember, removeMember };
