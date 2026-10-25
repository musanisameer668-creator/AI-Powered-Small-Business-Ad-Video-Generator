import mongoose from 'mongoose';
const { Schema } = mongoose;
const schema = new Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['draft', 'generating', 'ready', 'failed'], default: 'draft' },
  input: { type: Schema.Types.Mixed, default: {} },
  content: { type: Schema.Types.Mixed, default: null },
  progress: { type: Schema.Types.Mixed, default: {} },
  assets: { type: Schema.Types.Mixed, default: {} },
  notes: { type: [String], default: [] },
  error: { type: String, default: '' },
  mode: { type: String, default: '' },
}, { timestamps: true, minimize: false });
export default mongoose.models.Project || mongoose.model('Project', schema);
