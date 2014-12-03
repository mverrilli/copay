'use strict';

angular.module('copayApp.controllers').controller('HomeController', function($scope, $rootScope, $location, $timeout, notification, identityService, Compatibility, pinService, applicationService, isMobile) {


  var _credentials;

  $scope.init = function() {
    // This is only for backwards compat, insight api should link to #!/confirmed directly
    if (getParam('confirmed')) {
      var hashIndex = window.location.href.indexOf('/?');
      window.location = window.location.href.substr(0, hashIndex) + '#!/confirmed';
      return;
    }

    if ($rootScope.fromEmailConfirmation) {
      $scope.confirmedEmail = true;
      $rootScope.fromEmailConfirmation = false;
    }

    if ($rootScope.iden) {
      identityService.goWalletHome();
    }

    Compatibility.check($scope);
    pinService.check(function(err, value) {
      $rootScope.hasPin = value;
    });
  };

  Object.defineProperty($scope,
    "pin", {
      get: function() {
        return this._pin;
      },
      set: function(newValue) {
        this._pin = newValue;
        if (newValue && newValue.length == 4) {
          $scope.openPin(newValue);
        }
        if (!newValue) {
          $scope.error = null;
        }
      },
      enumerable: true,
      configurable: true
    });

  Object.defineProperty($scope,
    "newpin", {
      get: function() {
        return this._newpin;
      },
      set: function(newValue) {
        this._newpin = newValue;
        if (newValue && newValue.length == 4) {
          // next input
          $scope.$$childTail.secondPin = true;
        }
      },
      enumerable: true,
      configurable: true
    });

  Object.defineProperty($scope,
    "repeatpin", {
      get: function() {
        return this._repeatpin;
      },
      set: function(newValue) {
        this._repeatpin = newValue;
        if (newValue && newValue.length == 4) {
          if ($scope.$$childTail._newpin === newValue) {
            // save and submit
            $scope.createPin($scope.$$childTail.setPinForm);
          } else {
            $scope.error = 'Entered PINs were not equal. Try again';
          }
        }
        if (!newValue) {
          $scope.error = null;
        }
      },
      enumerable: true,
      configurable: true
    });

  $scope.done = function() {
    $rootScope.starting = false;
    $rootScope.$digest();
  };


  $scope.$on("$destroy", function() {
    var iden = $rootScope.iden;
    if (iden) {
      iden.removeListener('newWallet', $scope.done);
      iden.removeListener('noWallets', $scope.done);
    }
  });

  $scope.openWithPin = function(form) {
    $scope.confirmedEmail = false;
    if (form && form.$invalid) {
      $scope.error = 'Please enter the required fields';
      return;
    }
    $scope.openPin(pin);
  };

  $scope.openPin = function(pin) {
    var credentials = pinService.get(pin, function(err, credentials) {
      if (err || !credentials) {
        $scope.error = 'Wrong PIN';
        return;
      }
      $rootScope.starting = true;
      $scope.open(credentials.email, credentials.password);
    });
  };


  $scope.openWallets = function() {
    preconditions.checkState($rootScope.iden);
    var iden = $rootScope.iden;

    $rootScope.hideNavigation = false;
    $rootScope.starting = true;
    iden.on('newWallet', $scope.done);
    iden.on('noWallets', $scope.done);
    iden.openWallets();
  };

  $scope.createPin = function(form) {
    if (!form) return;
    preconditions.checkState($rootScope.iden);
    preconditions.checkState(_credentials && _credentials.email);

    pinService.save(form.repeatpin.$modelValue, _credentials.email, _credentials.password, function(err) {
      _credentials.password = '';
      _credentials = null;
      $rootScope.hasPin = true;
      $scope.openWallets();
    });
  };

  $scope.openWithCredentials = function(form) {
    $scope.confirmedEmail = false;
    if (form && form.$invalid) {
      $scope.error = 'Please enter the required fields';
      return;
    }

    $scope.open(form.email.$modelValue, form.password.$modelValue);
  };


  $scope.pinLogout = function() {
    pinService.clear(function() {
      copay.logger.debug('PIN erased');
      delete $rootScope['hasPin'];
      applicationService.reload();
    });
  };

  $scope.open = function(email, password) {
    $rootScope.starting = true;
    identityService.open(email, password, function(err, iden) {
      if (err) {
        $rootScope.starting = false;
        copay.logger.warn(err);
        if ((err.toString() || '').match('PNOTFOUND')) {
          $scope.error = 'Invalid email or password';
          pinService.clear(function() {
            copay.logger.debug('PIN erased');
          });
        } else if ((err.toString() || '').match('Connection')) {
          $scope.error = 'Could not connect to Insight Server';
        } else if ((err.toString() || '').match('Unable')) {
          $scope.error = 'Unable to read data from the Insight Server';
        } else {
          $scope.error = 'Unknown error';
        }
        $rootScope.starting = false;
        $rootScope.$digest();
        return;
      }

      // Open successfully?
      if (iden) {

        // mobile
        //if (isMobile.any() && !$rootScope.hasPin) {
        if (true && !$rootScope.hasPin) {
          $scope.done();
          _credentials = {
            email: email,
            password: password,
          };
          $scope.askForPin = true;
          $rootScope.starting = false;
          $rootScope.hideNavigation = true;
          $rootScope.$digest();
          return;
        }
        // no mobile
        else {
          $scope.openWallets();
        }
      }
    });
  }

  function getParam(sname) {
    var params = location.search.substr(location.search.indexOf("?") + 1);
    var sval = "";
    params = params.split("&");
    // split param and value into individual pieces
    for (var i = 0; i < params.length; i++) {
      var temp = params[i].split("=");
      if ([temp[0]] == sname) {
        sval = temp[1];
      }
    }
    return sval;
  }
});
