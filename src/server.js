/* eslint-disable no-underscore-dangle */
require('dotenv').config();

const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');
const Inert = require('@hapi/inert');
const path = require('path');

const notes = require('./api/notes');
const NotesService = require('./service/postgres/NotesService');
const NotesValidator = require('./validator/notes');

const users = require('./api/users');
const UsersService = require('./service/postgres/UsersServics');
const UsersValidator = require('./validator/users');

const authentications = require('./api/authentications');
const AuthenticationsService = require('./service/postgres/authenticationsService');
const TokenManager = require('./tokenize/TokenManager');
const AuthenticationsValidator = require('./validator/Authentications');

const collaborations = require('./api/collaborations');
const CollaborationsService = require('./service/postgres/CollaborationsService');
const CollaborationsValidator = require('./validator/Collaborations');

const _exports = require('./api/exports');
const ProducerService = require('./service/rabbitmq/ProducerService');
const ExportsValidator = require('./validator/Exports');

const uploads = require('./api/uploads');
const UploadsValidator = require('./validator/Uploads');
const StorageService = require('./service/storage/StorageService');

const CacheService = require('./service/redis/CacheService');

const init = async () => {
  const cacheService = new CacheService();
  const collaborationsService = new CollaborationsService(cacheService);
  const notesService = new NotesService(collaborationsService, cacheService);
  const usersService = new UsersService();
  const authenticationsService = new AuthenticationsService();
  const storageService = new StorageService(path.resolve(__dirname, 'api/uploads/file/images'));
  const server = Hapi.server({
    port: process.env.PORT,
    host: process.env.HOST,
    routes: {
      cors: {
        origin: ['*'],
      },
    },
  });

  await server.register([
    {
      plugin: Jwt,
    },
    {
      plugin: Inert,
    },
  ]);

  server.auth.strategy('notesapp_jwt', 'jwt', {
    keys: process.env.ACCESS_TOKEN_KEY,
    verify: {
      aud: false,
      iss: false,
      sub: false,
      maxAgeSec: process.env.ACCESS_TOKEN_AGE,
    },
    validate: (artifacts) => ({
      isValid: true,
      credentials: {
        id: artifacts.decoded.payload.id,
      },
    }),
  });

  await server.register([{
    plugin: notes,
    options: {
      service: notesService,
      validator: NotesValidator,
    },
  },
  {
    plugin: users,
    options: {
      service: usersService,
      validator: UsersValidator,
    },
  },
  {
    plugin: authentications,
    options: {
      authenticationsService,
      usersService,
      tokenManager: TokenManager,
      validator: AuthenticationsValidator,
    },
  },
  {
    plugin: collaborations,
    options: {
      collaborationsService,
      notesService,
      validator: CollaborationsValidator,
    },
  },
  {
    plugin: _exports,
    options: {
      service: ProducerService,
      validator: ExportsValidator,
    },
  },
  {
    plugin: uploads,
    options: {
      service: storageService,
      validator: UploadsValidator,
    },
  },
  ]);

  await server.start();
  console.log(`Server berjalan pada ${server.info.uri}`);
};

init();
