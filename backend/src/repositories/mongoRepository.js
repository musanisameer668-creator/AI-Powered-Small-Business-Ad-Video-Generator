import mongoose from 'mongoose';
import User from '../models/User.js';
import Project from '../models/Project.js';

const plain = (doc) => {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject({ minimize: false }) : doc;
  const { _id, __v, ...rest } = o;
  return { id: String(_id), ...rest, createdAt: new Date(o.createdAt).toISOString(), updatedAt: new Date(o.updatedAt).toISOString() };
};
const validId = (id) => mongoose.isValidObjectId(id);

export function createMongoRepository(uri) {
  return {
    kind: 'mongodb',
    async connect() {
      // fail fast with a readable message instead of waiting 30s
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    },
    async flush() {},
    users: {
      async create(data) { return plain(await User.create(data)); },
      async findByEmail(email) { return plain(await User.findOne({ email })); },
      async findById(id) { return validId(id) ? plain(await User.findById(id)) : null; },
      async update(id, patch) { return validId(id) ? plain(await User.findByIdAndUpdate(id, patch, { new: true })) : null; },
    },
    projects: {
      async create(data) { return plain(await Project.create(data)); },
      async listByUser(userId) { return (await Project.find({ userId }).sort({ updatedAt: -1 })).map(plain); },
      async get(id) { return validId(id) ? plain(await Project.findById(id)) : null; },
      async update(id, patch) {
        return validId(id) ? plain(await Project.findByIdAndUpdate(id, { $set: patch }, { new: true })) : null;
      },
      async remove(id) { return validId(id) ? !!(await Project.findByIdAndDelete(id)) : false; },
      async failStaleJobs(message) {
        const r = await Project.updateMany({ status: 'generating' }, { $set: { status: 'failed', error: message } });
        return r.modifiedCount || 0;
      },
    },
  };
}
