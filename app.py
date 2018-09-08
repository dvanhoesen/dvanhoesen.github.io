import matplotlib as mpl
mpl.use('Agg')
import json
from flask import Flask, request, render_template
import matplotlib.pyplot as plt
import os
import io
import base64
from db import create_database, create_table
# from definitions import DATABASE_NAME
from numpy import loadtxt, arange, array, argmax, amax, amin
from flask.json import jsonify
import subprocess as sp

app = Flask(__name__)


# Create the base plot for the data
def plotter(data):
    img = io.BytesIO()
    y = data
    x = arange(len(data))
    
    plt.plot(x,y, label='something', color='blue')
    plt.legend(loc='best')
    plt.ylabel('')
    plt.xlabel('')
    plt.title('')
    plt.savefig(img, format='png')
    plt.cla()
    plt.clf()
    img.seek(0)
    return  base64.b64encode(img.getvalue()).decode()


@app.errorhandler(404)
def page_not_found(e):
    return render_template('errors/404.html'), 404


@app.errorhandler(500)
def page_crash(e):
    return render_template('errors/500.html'), 500


# This route loads different Keras models
@app.route('/')
def model(var=''):

	if True:
	    data = [1.0, 4.0, 2.0, 12.0, 0.1, 10.0]
	    model_plot = plotter(data)
        return render_template('index.html',
                           model_plot=image)
    else:
		return render_template('models/error.html')

"""
@app.route('/exists', methods=['POST'])
def exists():
    r = request.get_json()
    symbol = r['symbol']
    begin = r['datetime']
    model = r['model_number']
    result = find_entry(symbol, begin, model)
    if result is not None:
        return json.dumps({'status': 'exists', 'shape': result[5]}) # 5 is `marked`
    else:
        return json.dumps({'status': 'failure'})


@app.route('/save_marked', methods=['POST'])
def save_marked():
    f = request.get_json()
    symbol = f['symbol']
    begin_time = f['datetime']
    predicted = f['predicted_shape']
    probability = f['shape_probability']
    marked = f['marked_shape']
    model = f['model_number']

    # try to find if the entry exists
    entry = find_entry(symbol, begin_time, model)
    if entry is None:
        try:
            conn = sqlite3.connect(DATABASE_NAME)
            c = conn.cursor()
            data_insert = [(symbol, begin_time, predicted, probability, marked, model)]
            c.executemany('insert into entries values (NULL,?,?,?,?,?,?)', data_insert)
            conn.commit()
            conn.close()
            return json.dumps({'status': 'success'})
        except Exception as e:
            print(e)
    else:
        return json.dumps({'status': 'exists'})    
    return json.dumps({'status': 'failure'})
"""

if __name__ == '__main__':
    app.register_error_handler(404, page_not_found)
    app.register_error_handler(500, page_crash)
    app.jinja_env.auto_reload = True
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    app.debug = True
    app.run(host='0.0.0.0')
