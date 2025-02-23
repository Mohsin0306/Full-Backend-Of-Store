const Joi = require('joi');

const validateAdminProfileUpdate = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50),
    username: Joi.string().min(3).max(30),
    email: Joi.string().email(),
    phoneNumber: Joi.string().pattern(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/),
    bio: Joi.string().max(500).allow(''),
    profilePicture: Joi.alternatives().try(
      Joi.object({
        public_id: Joi.string().allow(''),
        url: Joi.string().uri().allow('')
      }),
      Joi.string()
    ).allow(null),
    socialLinks: Joi.object({
      facebook: Joi.string().uri().allow(''),
      twitter: Joi.string().uri().allow(''),
      instagram: Joi.string().uri().allow(''),
      linkedin: Joi.string().uri().allow('')
    }),
    businessDetails: Joi.object({
      companyName: Joi.string().max(100).allow(''),
      businessAddress: Joi.string().max(200).allow(''),
      businessPhone: Joi.string().pattern(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/).allow(''),
      businessEmail: Joi.string().email().allow('')
    }),
    isAdmin: Joi.boolean(),
    lastUpdated: Joi.date(),
    createdAt: Joi.date(),
    updatedAt: Joi.date(),
    buyers: Joi.array().items(Joi.string()),
    _id: Joi.string(),
    __v: Joi.number()
  }).unknown(true); // Allow unknown fields

  return schema.validate(data);
};

module.exports = validateAdminProfileUpdate; 