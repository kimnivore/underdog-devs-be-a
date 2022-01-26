const express = require('express');
const authRequired = require('../middleware/authRequired');
const Application = require('./applicationModel');
const Profile = require('../profile/profileModel');
const router = express.Router();
const jwt = require('jwt-decode');
const { adminRequired } = require('../middleware/permissionsRequired.js');
const { validateProfile, checkRole } = require('./applicationMiddleware');

const okta = require('@okta/okta-sdk-nodejs');

const client = new okta.Client({
  orgUrl: 'https://dev-1234.oktapreview.com/',
  token: 'xYzabc',
  // Token is innacurate. Obtain from developer dashboard // process.ENV.REGISTRATION_TOKEN || 'kYid3874'
});

/**
 * @swagger
 * components:
 *  schemas:
 *    Application:
 *      type: object
 *      required:
 *        - position
 *        - profile_id
 *      properties:
 *        application_id:
 *          type: integer
 *          description: Unique primary key referencing the application's numeric ID
 *        position:
 *          type: integer
 *          description: Foreign key referencing a numeric role ID for an applicant's desired position
 *        profile_id:
 *          type: string
 *          description: Foreign key referencing the applicant's profile ID
 *        approved:
 *          type: boolean
 *          description: Status of whether or not an application has been approved - defaults to false
 *        created_at:
 *          type: timestamp
 *          description: Record of an application's creation time
 *      example:
 *        application_id: 1
 *        position: 4
 *        profile_id: '10'
 *        approved: false
 *        created_at: "2021-11-01T17:59:02.023Z"
 */

// get all pending application tickets

router.get('/', authRequired, adminRequired, (req, res, next) => {
  Application.getPendingTickets()
    .then((applicationList) => {
      res.status(200).json(applicationList);
    })
    .catch(next);
});

// get pending application tickets by role

router.get('/:role', authRequired, adminRequired, (req, res, next) => {
  Application.getPendingTicketsByRole(req.params.role)
    .then((applicationList) => {
      res.status(200).json(applicationList);
    })
    .catch(next);
});

// get application by profile id

router.get('/profileId/:id', validateProfile, checkRole, (req, res) => {
  res.status(200).json(req.body);
});

// post a new application for the current logged in user

router.post('/new-application', authRequired, function (req, res, next) {
  const token = req.headers.authorization;
  const User = jwt(token);
  const newApplication = req.body;
  Application.add(User.sub, newApplication)
    .then(() => {
      res.status(201).json({ message: 'Application has been submitted' });
    })
    .catch(next);
});

// update the role_id for the profile of the applicant and update the application approved value to true

router.put('/update-role', authRequired, adminRequired, (req, res, next) => {
  const profile_id = req.body.profile_id;
  const application_id = req.body.application_id;
  const role_id = req.body.position;
  Profile.update(profile_id, { role_id: role_id })
    .then(() => {
      Application.updateTicket(application_id, { approved: true })
        .then(() => {
          res.status(202).json({
            message:
              'This application has been approved, and User role has been updated',
          });
        })
        .catch(next);
    })
    .catch(next);
});

// post the information for the mentee intake for the currently logged in user

router.post('/new-mentee', authRequired, function (req, res, next) {
  const token = req.headers.authorization;
  const User = jwt(token);
  const newMenteeIntake = req.body;
  Application.insertMenteeIntake(User.sub, newMenteeIntake)
    .then(() => {
      res.status(201).json({ message: 'Information has been submitted' });
    })
    .catch(next);
});

// post the information for the mentor intake for the currently logged in user

router.post('/new-mentor', authRequired, function (req, res, next) {
  const token = req.headers.authorization;
  const User = jwt(token);
  const newMentorIntake = req.body;
  Application.insertMentorIntake(User.sub, newMentorIntake)
    .then(() => {
      res.status(201).json({ message: 'Information has been submitted' });
    })
    .catch(next);
});

// update applicants status and attach intake data to createUser method

router.put('/update-status/:id', validateProfile, (req, res, next) => {
  // application 'approved' boolean toggles
  const application_id = req.body.application_id;
  Application.updateTicket(application_id, { approved: true }).then(() => {
    res.status(202).json({
      message:
        'This application has been approved and registration process is under way..',
    });
  });
  // okta registration flow starts here
  const newUser = {
    profile: {
      firstName: req.body.first_name,
      lastName: req.body.last_name,
      email: req.body.email,
      login: req.body.email,
    },
    credentials: {
      password: {
        value: 'generate this temp password',
      },
    },
  };
  client.createUser(newUser).then((user) => {
    console.log('Created user', user);
    next();
  });
});

module.exports = router;
