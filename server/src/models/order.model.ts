
import mongoose, { Document, Schema } from "mongoose";

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface IOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface IOrder extends Document {
  customerName: string;
  customerNameLower: string;
  customerEmail: string;
  status: OrderStatus;
  items: IOrderItem[];
  total: number;
  createdBy: mongoose.Types.ObjectId;
  idempotencyKey: string;
  requestHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    customerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    customerNameLower: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    customerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: IOrderItem[]) =>
          items.length >= 1 && items.length <= 100,
        message: "An order must contain between 1 and 100 items",
      },
    },
    total: { type: Number, required: true, min: 0 },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    idempotencyKey: { type: String, required: true },
    requestHash: { type: String, required: true },
  },
  { timestamps: true }
);

orderSchema.index(
  { createdBy: 1, idempotencyKey: 1 },
  { unique: true, name: "unique_order_idempotency" }
);

orderSchema.index({ createdAt: -1, _id: -1 }); 
orderSchema.index({ total: -1, _id: -1 }); 
orderSchema.index({ status: 1, createdAt: -1, _id: -1 }); 
orderSchema.index({ status: 1, total: -1, _id: -1 }); 
orderSchema.index({ customerEmail: 1 }); 
orderSchema.index({ customerNameLower: 1 }); 

export const Order = mongoose.model<IOrder>("Order", orderSchema);