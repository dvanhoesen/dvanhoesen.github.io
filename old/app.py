import matplotlib as mpl
mpl.use('Agg')
import json
from flask import Flask, request, render_template
import matplotlib.pyplot as plt
import os
import io
import base64
from db import create_database, create_table
from numpy import loadtxt, arange, array, argmax, amax, amin
from flask.json import jsonify
import subprocess as sp

app = Flask(__name__)


@app.errorhandler(404)
def page_not_found(e):
    return render_template('errors/404.html'), 404


if __name__ == '__main__':
    app.register_error_handler(404, page_not_found)
    app.jinja_env.auto_reload = True
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    app.debug = True
    app.run(host='0.0.0.0')
