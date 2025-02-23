const Joi = require('joi');

const validateProfileUpdate = (data) => {
  const schema = Joi.object({
    firstName: Joi.string().min(2).max(30).allow(''),
    lastName: Joi.string().min(2).max(30).allow(''),
    phoneNumber: Joi.string().pattern(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/).allow(''),
    address: Joi.string().max(100).allow(''),
    city: Joi.string().max(50).allow(''),
    country: Joi.string().max(50).allow(''),
    preferredScents: Joi.alternatives().try(
      Joi.array().items(Joi.string().min(1)).min(0),
      Joi.string().allow('')
    ).optional(),
    allergies: Joi.alternatives().try(
      Joi.array().items(Joi.string().min(1)).min(0),
      Joi.string().allow('')
    ).optional(),
    bio: Joi.string().max(500).allow('')
  });

  return schema.validate(data);
};

module.exports = validateProfileUpdate; 